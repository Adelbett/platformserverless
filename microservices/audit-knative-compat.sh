#!/bin/bash
#
# audit-knative-compat.sh
# ------------------------
# Audite un repo (déjà cloné en local) pour détecter les patterns
# incompatibles avec Knative Serving / Eventing.
#
# Usage :
#   ./audit-knative-compat.sh /chemin/vers/le/repo
#
# Le script ne modifie rien, il fait juste des greps/vérifications
# et affiche un rapport avec des ⚠️ pour chaque problème potentiel.

set -uo pipefail

REPO_DIR="${1:-.}"

if [ ! -d "$REPO_DIR" ]; then
    echo "❌ Le dossier '$REPO_DIR' n'existe pas."
    exit 1
fi

cd "$REPO_DIR" || exit 1

WARNINGS=0
OK=0

warn() {
    echo "⚠️  $1"
    WARNINGS=$((WARNINGS + 1))
}

pass() {
    echo "✅ $1"
    OK=$((OK + 1))
}

info() {
    echo "ℹ️  $1"
}

echo "========================================================"
echo " Audit de compatibilité Knative — $(basename "$(pwd)")"
echo "========================================================"
echo ""

# ---------------------------------------------------------------
# 1. Dockerfile présent ?
# ---------------------------------------------------------------
echo "--- 1. Dockerfile ---"
DOCKERFILE=$(find . -maxdepth 2 -iname "Dockerfile*" | head -n 1)
if [ -z "$DOCKERFILE" ]; then
    warn "Aucun Dockerfile trouvé (racine ou sous-dossier direct). Tu devras en écrire un toi-même."
else
    pass "Dockerfile trouvé : $DOCKERFILE"

    # Nombre de ports EXPOSE
    EXPOSE_COUNT=$(grep -ci "^EXPOSE" "$DOCKERFILE" || true)
    EXPOSE_LINES=$(grep -i "^EXPOSE" "$DOCKERFILE" || true)
    if [ "$EXPOSE_COUNT" -gt 1 ]; then
        warn "Plusieurs ports EXPOSE détectés dans le Dockerfile :"
        echo "$EXPOSE_LINES" | sed 's/^/     /'
        echo "     → Knative Serving ne route que sur UN SEUL port. Vérifie lequel est le port HTTP principal."
    elif [ "$EXPOSE_COUNT" -eq 1 ]; then
        pass "Un seul port EXPOSE détecté :"
        echo "$EXPOSE_LINES" | sed 's/^/     /'
    else
        info "Aucun EXPOSE explicite (pas bloquant, mais vérifie le port applicatif manuellement)."
    fi
fi
echo ""

# ---------------------------------------------------------------
# 2. Frameworks / signaux HTTP server
# ---------------------------------------------------------------
echo "--- 2. Détection framework HTTP ---"
HTTP_SIGNS=0
grep -rIlE "express\(\)|app\.listen|@RestController|@SpringBootApplication|flask|FastAPI|http\.createServer|net/http|gin\.Default" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.java" --include="*.go" . 2>/dev/null \
    | head -5 | while read -r f; do
        echo "     trouvé dans: $f"
        HTTP_SIGNS=1
    done

if grep -rqIE "express\(\)|app\.listen|@RestController|@SpringBootApplication|flask|FastAPI|http\.createServer|net/http|gin\.Default" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.java" --include="*.go" . 2>/dev/null; then
    pass "Le projet semble exposer un serveur HTTP (bon signe pour Eventing, qui envoie via POST HTTP)."
else
    warn "Aucun framework HTTP détecté. Si le service ne reçoit pas de requêtes HTTP, Knative Eventing ne pourra pas lui envoyer d'events (les Triggers livrent via HTTP POST)."
fi
echo ""

# ---------------------------------------------------------------
# 3. Consumer Kafka natif en dur dans le code (conflit possible)
# ---------------------------------------------------------------
echo "--- 3. Consumer Kafka natif dans le code applicatif ---"
if grep -rqIE "KafkaConsumer|kafka-python|kafkajs|new Kafka\(|@KafkaListener" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.java" --include="*.go" . 2>/dev/null; then
    warn "Un consumer Kafka natif est codé en dur dans l'application."
    echo "     → Si tu comptes aussi utiliser un KafkaSource Knative sur le même topic,"
    echo "       tu auras DEUX consumers en compétition (double consumption ou conflit de group)."
    echo "     → Pour tester Eventing proprement, retire ce consumer et laisse Knative router via HTTP."
else
    pass "Pas de consumer Kafka natif détecté — le service dépendra bien du routage HTTP de Knative Eventing."
fi
echo ""

# ---------------------------------------------------------------
# 4. WebSocket / connexions longues
# ---------------------------------------------------------------
echo "--- 4. WebSocket / connexions persistantes ---"
if grep -rqIE "socket\.io|WebSocketServer|ws://|wss://|@ServerEndpoint|gorilla/websocket" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.java" --include="*.go" . 2>/dev/null; then
    warn "Usage de WebSocket / connexions longues détecté."
    echo "     → Knative peut couper le pod après idle timeout même si une connexion WS reste ouverte."
    echo "       Pas bloquant pour un test ponctuel, mais évite en usage réel avec minScale=0."
else
    pass "Pas de WebSocket détecté — compatible avec le modèle requête/réponse court de Knative."
fi
echo ""

# ---------------------------------------------------------------
# 5. Boucle infinie / worker polling (pas de serveur HTTP actif)
# ---------------------------------------------------------------
echo "--- 5. Pattern worker / polling infini ---"
if grep -rqIE "while\s*\(\s*true\s*\)|while\s+True\s*:|for\s*\(\s*;\s*;\s*\)" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.java" --include="*.go" . 2>/dev/null; then
    warn "Boucle infinie détectée dans le code (while(true) / while True)."
    echo "     → Si c'est un worker qui poll une queue en continu sans jamais servir de requête HTTP,"
    echo "       Knative va le scale-to-zero même s'il 'travaille', car il ne voit aucun trafic entrant."
else
    pass "Pas de pattern de boucle infinie évidente détecté."
fi
echo ""

# ---------------------------------------------------------------
# 6. Base de données obligatoire au démarrage
# ---------------------------------------------------------------
echo "--- 6. Dépendance base de données ---"
if grep -rqIE "mongodb://|postgresql://|jdbc:|mysql://|MONGO_URI|DATABASE_URL" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.java" --include="*.go" --include="*.yml" --include="*.yaml" --include="*.env*" . 2>/dev/null; then
    warn "Le service semble dépendre d'une base de données externe."
    echo "     → Il faudra aussi déployer/brancher cette DB dans ton cluster (PostgreSQL/Mongo/Redis existants ?)."
    echo "       Sinon le pod restera en CrashLoopBackOff au démarrage."
else
    pass "Pas de dépendance DB évidente — démarrage probablement autonome."
fi
echo ""

# ---------------------------------------------------------------
# 7. docker-compose avec plusieurs services (complexité)
# ---------------------------------------------------------------
echo "--- 7. docker-compose multi-services ---"
COMPOSE_FILE=$(find . -maxdepth 2 -iname "docker-compose*.yml" -o -iname "docker-compose*.yaml" | head -n 1)
if [ -n "$COMPOSE_FILE" ]; then
    SERVICE_COUNT=$(grep -cE "^\s{2}[a-zA-Z0-9_-]+:\s*$" "$COMPOSE_FILE" || true)
    if [ "$SERVICE_COUNT" -gt 1 ]; then
        warn "docker-compose.yml avec $SERVICE_COUNT services détectés."
        echo "     → Ce n'est pas un simple microservice isolé : il dépend d'autres containers"
        echo "       (DB, cache, autre API...). Il faudra soit les déployer aussi, soit isoler juste le service HTTP."
    else
        pass "docker-compose.yml trouvé mais semble simple (1 service)."
    fi
else
    info "Pas de docker-compose.yml — probablement un service isolé (bon signe pour la simplicité)."
fi
echo ""

# ---------------------------------------------------------------
# Résumé
# ---------------------------------------------------------------
echo "========================================================"
echo " Résumé : $OK point(s) OK — $WARNINGS avertissement(s)"
echo "========================================================"
if [ "$WARNINGS" -eq 0 ]; then
    echo "🎉 Bon candidat pour un test Knative Serving + Eventing."
elif [ "$WARNINGS" -le 2 ]; then
    echo "🙂 Candidat correct, mais vérifie manuellement les points signalés ci-dessus."
else
    echo "🤔 Ce repo a plusieurs points de friction avec Knative. Envisage un microservice plus simple"
    echo "   (ex: un 'event-display' officiel Knative, ou un petit webhook receiver stateless)."
fi
