#!/usr/bin/env bash
# ==============================================================================
# diagnose-frontend-freeze.sh
#
# Diagnostic READ-ONLY complet pour PlatformServerless.
# Objectif : comprendre pourquoi les deux portails (web-portal, admin-console)
# restent bloques en chargement apres l'execution d'une fonctionnalite, alors
# meme que l'operation aboutit cote Kubernetes.
#
# Ce script ne modifie, ne supprime et ne redemarre RIEN. Il ne fait que lire
# et collecter des informations (kubectl get/describe/logs/top, quelques exec
# read-only). Tout est ecrit dans un dossier horodate puis compresse en
# .tar.gz a la fin.
#
# Usage :
#   chmod +x diagnose-frontend-freeze.sh
#   ./diagnose-frontend-freeze.sh
#
# A executer depuis vm01 (control-plane), avec un kubectl deja configure.
# ==============================================================================

set -uo pipefail

TS="$(date +%Y%m%d-%H%M%S)"
OUTDIR="diag-${TS}"
REPORT="${OUTDIR}/REPORT.md"

PLATFORM_NS="platform"
KAFKA_NS="kafka"
MONITORING_NS="monitoring"
KNATIVE_SERVING_NS="knative-serving"
KNATIVE_EVENTING_NS="knative-eventing"
CILIUM_NS="kube-system"
KOURIER_NS="kourier-system"

mkdir -p "${OUTDIR}"/{cluster,platform,backend,frontend,kafka,knative,network,resources,sse,elasticsearch}

# ------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------

echo "# Rapport de diagnostic PlatformServerless — ${TS}" > "${REPORT}"
echo "" >> "${REPORT}"
echo "Genere par diagnose-frontend-freeze.sh — lecture seule, aucune modification du cluster." >> "${REPORT}"
echo "" >> "${REPORT}"

CRIT_COUNT=0
ERR_COUNT=0
WARN_COUNT=0
INFO_COUNT=0

# finding LEVEL COMPONENT RESOURCE ERROR WHY CHECK_CMD
finding() {
    local level="$1" component="$2" resource="$3" error="$4" why="$5" cmd="$6"
    case "$level" in
        CRITICAL) CRIT_COUNT=$((CRIT_COUNT+1)) ;;
        ERROR)    ERR_COUNT=$((ERR_COUNT+1)) ;;
        WARNING)  WARN_COUNT=$((WARN_COUNT+1)) ;;
        INFO)     INFO_COUNT=$((INFO_COUNT+1)) ;;
    esac
    {
        echo "### [${level}] ${component} — ${resource}"
        echo ""
        echo "- **Erreur detectee** : ${error}"
        echo "- **Pourquoi ca peut expliquer le blocage des portails** : ${why}"
        echo "- **Commande pour verifier davantage** : \`${cmd}\`"
        echo ""
    } >> "${REPORT}"
}

section() {
    echo "" >> "${REPORT}"
    echo "## $1" >> "${REPORT}"
    echo "" >> "${REPORT}"
}

run() {
    # run "description" "outfile" -- command...
    local desc="$1" out="$2"; shift 2
    echo ">> ${desc}"
    { echo "\$ $*"; echo; eval "$@" ; } > "${out}" 2>&1
}

kx() { kubectl "$@" 2>/dev/null; }

echo "=============================================================="
echo " Diagnostic PlatformServerless — lecture seule — ${TS}"
echo " Resultats dans : ${OUTDIR}/"
echo "=============================================================="
echo ""

# ==========================================================================
# 1. ETAT GENERAL DU CLUSTER
# ==========================================================================
section "1. Etat general du cluster Kubernetes"

run "Nodes (get)"        "${OUTDIR}/cluster/nodes.txt"        kubectl get nodes -o wide
run "Nodes (describe)"   "${OUTDIR}/cluster/nodes-describe.txt" kubectl describe nodes
run "Cluster info"       "${OUTDIR}/cluster/cluster-info.txt" kubectl cluster-info
run "API resources"      "${OUTDIR}/cluster/api-resources.txt" kubectl api-resources
run "Component status"   "${OUTDIR}/cluster/componentstatuses.txt" "kubectl get componentstatuses || true"
run "Events (all ns, sorted)" "${OUTDIR}/cluster/events-all.txt" kubectl get events -A --sort-by=.lastTimestamp

# Nodes NotReady
NOT_READY=$(kx get nodes --no-headers | awk '$2 != "Ready" {print $1}')
if [ -n "$NOT_READY" ]; then
    finding "CRITICAL" "Cluster" "Nodes" \
        "Node(s) non-Ready detecte(s) : ${NOT_READY}" \
        "Si un worker est NotReady, les pods qui y tournent (backend, frontend) peuvent devenir injoignables, provoquant des timeouts HTTP cote navigateur (pages qui restent en chargement)." \
        "kubectl describe node <nom-du-node>"
fi

# Pressure conditions (Memory/Disk/PID)
PRESSURE=$(kx get nodes -o json | grep -E '"type": "(MemoryPressure|DiskPressure|PIDPressure)"' -A2 | grep '"status": "True"' | wc -l)
if [ "${PRESSURE:-0}" -gt 0 ]; then
    finding "CRITICAL" "Cluster" "Nodes" \
        "Au moins une condition de pression (Memory/Disk/PID Pressure) est a True sur un node." \
        "Sous pression memoire/disque, le kubelet peut evincer des pods ou refuser d'en planifier de nouveaux, ce qui peut geler des requetes en cours (SSE, HTTP) sans erreur explicite cote client." \
        "kubectl describe nodes | grep -A5 Conditions"
fi

# API server latency probe
API_START=$(date +%s%N)
kx get --raw='/healthz' > "${OUTDIR}/cluster/apiserver-healthz.txt"
API_END=$(date +%s%N)
API_MS=$(( (API_END - API_START) / 1000000 ))
echo "API server /healthz round-trip: ${API_MS} ms" >> "${OUTDIR}/cluster/apiserver-healthz.txt"
if [ "${API_MS}" -gt 2000 ]; then
    finding "WARNING" "Cluster" "kube-apiserver" \
        "Le round-trip vers /healthz a pris ${API_MS} ms (> 2s)." \
        "Si le backend appelle frequemment l'API Kubernetes via Fabric8 (watchers, creation de ressources), une API server lente ralentit ou bloque ces appels, qui peuvent eux-memes bloquer des threads HTTP synchrones du backend." \
        "kubectl get --raw='/healthz' -v=6"
fi

# ==========================================================================
# 2. NAMESPACE platform
# ==========================================================================
section "2. Namespace platform — pods, deployments, replicasets, services, endpoints"

run "Pods (wide)"        "${OUTDIR}/platform/pods.txt"        kubectl get pods -n "${PLATFORM_NS}" -o wide
run "Deployments"        "${OUTDIR}/platform/deployments.txt" kubectl get deployments -n "${PLATFORM_NS}" -o wide
run "ReplicaSets"        "${OUTDIR}/platform/replicasets.txt" kubectl get rs -n "${PLATFORM_NS}" -o wide
run "Services"           "${OUTDIR}/platform/services.txt"    kubectl get svc -n "${PLATFORM_NS}" -o wide
run "Endpoints"          "${OUTDIR}/platform/endpoints.txt"   kubectl get endpoints -n "${PLATFORM_NS}"
run "Events (platform)"  "${OUTDIR}/platform/events.txt"      "kubectl get events -n ${PLATFORM_NS} --sort-by=.lastTimestamp"
run "Describe pods"      "${OUTDIR}/platform/pods-describe.txt" kubectl describe pods -n "${PLATFORM_NS}"

# Restart counts / CrashLoopBackOff / OOMKilled / Pending
while read -r name ready status restarts age rest; do
    [ "$name" = "NAME" ] && continue
    [ -z "$name" ] && continue

    if [ "$status" = "CrashLoopBackOff" ]; then
        finding "CRITICAL" "Backend/Frontend" "Pod ${name} (ns ${PLATFORM_NS})" \
            "Statut CrashLoopBackOff." \
            "Un pod qui redemarre en boucle peut expliquer des requetes qui n'aboutissent jamais (le pod tombe en plein milieu d'une requete SSE ou HTTP longue) et un frontend qui reste en chargement indefiniment." \
            "kubectl describe pod ${name} -n ${PLATFORM_NS} && kubectl logs ${name} -n ${PLATFORM_NS} --previous"
    fi
    if [ "$status" = "Pending" ]; then
        finding "ERROR" "Backend/Frontend" "Pod ${name} (ns ${PLATFORM_NS})" \
            "Statut Pending (pas encore planifie/demarre)." \
            "Si le pod backend ou frontend est Pending (ressources insuffisantes, PVC non monte...), aucune requete ne peut aboutir, d'ou un frontend bloque en chargement permanent." \
            "kubectl describe pod ${name} -n ${PLATFORM_NS}"
    fi
    if [ "${restarts:-0}" != "0" ] 2>/dev/null && [ "${restarts:-0}" -ge 3 ] 2>/dev/null; then
        finding "WARNING" "Backend/Frontend" "Pod ${name} (ns ${PLATFORM_NS})" \
            "${restarts} redemarrages detectes." \
            "Des redemarrages frequents suggerent un crash recurrent (OOM, exception non geree, liveness probe qui echoue sous charge) susceptible de couper les connexions SSE/HTTP en cours." \
            "kubectl logs ${name} -n ${PLATFORM_NS} --previous"
    fi
done < <(kx get pods -n "${PLATFORM_NS}" --no-headers)

# OOMKilled specifically (lastState)
kx get pods -n "${PLATFORM_NS}" -o json > "${OUTDIR}/platform/pods.json"
if grep -q '"reason": "OOMKilled"' "${OUTDIR}/platform/pods.json" 2>/dev/null; then
    OOM_PODS=$(grep -B5 '"reason": "OOMKilled"' "${OUTDIR}/platform/pods.json" | grep '"name"' | head -5)
    finding "CRITICAL" "Backend/Frontend" "Pods (ns ${PLATFORM_NS})" \
        "Au moins un pod a ete tue par OOMKilled (voir pods.json, lastState.terminated.reason)." \
        "Un OOMKilled sur le backend coupe instantanement toutes les connexions ouvertes (SSE, requetes HTTP en cours), ce qui explique un frontend qui reste bloque en chargement le temps que le pod redemarre." \
        "kubectl describe pod <nom> -n ${PLATFORM_NS} | grep -A10 'Last State'"
fi

# Readiness / Liveness failures in events
if grep -qiE 'Unhealthy|Readiness probe failed|Liveness probe failed' "${OUTDIR}/platform/events.txt" 2>/dev/null; then
    finding "ERROR" "Backend/Frontend" "Pods (ns ${PLATFORM_NS})" \
        "Echecs de probes readiness/liveness detectes dans les events." \
        "Si le backend echoue temporairement ses probes (par ex. a cause d'un thread pool sature qui ne repond plus assez vite), il peut etre retire du Service (endpoint supprime), rendant le frontend incapable de joindre le backend le temps que ca se retablisse." \
        "kubectl get events -n ${PLATFORM_NS} --field-selector reason=Unhealthy"
fi

# Endpoints vides = service sans backend joignable
for svc in platform-api platform-web platform-admin; do
    EP=$(kx get endpoints "$svc" -n "${PLATFORM_NS}" -o jsonpath='{.subsets}' 2>/dev/null)
    if [ -z "$EP" ] || [ "$EP" = "[]" ]; then
        finding "CRITICAL" "Backend/Frontend" "Service ${svc} (ns ${PLATFORM_NS})" \
            "Le Service ${svc} n'a AUCUN endpoint (aucun pod pret derriere lui)." \
            "Si le Service backend/frontend n'a plus d'endpoint, toute requete envoyee dessus reste sans reponse ou timeout — exactement le symptome 'page bloquee en chargement' decrit." \
            "kubectl get endpoints ${svc} -n ${PLATFORM_NS} -o yaml"
    fi
done

# ==========================================================================
# 3. BACKEND SPRING BOOT — logs, exceptions, threads, async, fabric8, SSE, Kafka
# ==========================================================================
section "3. Backend Spring Boot — logs et diagnostics applicatifs"

BACKEND_POD=$(kx get pods -n "${PLATFORM_NS}" -l app=platform-api -o jsonpath='{.items[0].metadata.name}')
if [ -n "${BACKEND_POD:-}" ]; then
    run "Logs backend (2000 dernieres lignes)" "${OUTDIR}/backend/logs.txt" \
        kubectl logs "${BACKEND_POD}" -n "${PLATFORM_NS}" --tail=2000
    run "Logs backend --previous (si crash recent)" "${OUTDIR}/backend/logs-previous.txt" \
        "kubectl logs ${BACKEND_POD} -n ${PLATFORM_NS} --previous --tail=1000 || true"

    LOGFILE="${OUTDIR}/backend/logs.txt"

    # Exceptions generiques
    EXC_COUNT=$(grep -cE 'Exception|Error:' "${LOGFILE}" 2>/dev/null || echo 0)
    if [ "${EXC_COUNT}" -gt 0 ]; then
        finding "WARNING" "Backend" "Pod ${BACKEND_POD}" \
            "${EXC_COUNT} occurrence(s) du mot 'Exception'/'Error:' dans les 2000 dernieres lignes de logs." \
            "Des exceptions repetees peuvent indiquer un appel bloquant qui echoue en boucle (Kubernetes API, Kafka, Prometheus) et sature les threads qui retentent." \
            "grep -E 'Exception|Error:' ${LOGFILE} | sort | uniq -c | sort -rn | head -20"
    fi

    # HikariCP pool exhaustion (deja rencontre precedemment sur ce cluster)
    if grep -q "Connection is not available, request timed out" "${LOGFILE}" 2>/dev/null; then
        finding "CRITICAL" "Backend" "HikariCP (pool PostgreSQL)" \
            "'HikariPool-1 - Connection is not available, request timed out after ...ms' present dans les logs." \
            "Deja observe sur ce cluster : quand le pool de connexions PostgreSQL est epuise (souvent a cause de connexions SSE longues qui gardent des transactions ouvertes, ou de requetes qui ne liberent jamais leur connexion), TOUT endpoint qui a besoin de la base (donc quasiment toutes les pages) se met a attendre puis timeout — exactement le symptome des deux portails bloques en chargement en meme temps." \
            "grep -A3 'HikariPool-1' ${LOGFILE} | tail -60"
    fi

    # Thread pool / executor saturation
    if grep -qiE 'RejectedExecutionException|pool is full|Thread pool exhausted|task rejected' "${LOGFILE}" 2>/dev/null; then
        finding "CRITICAL" "Backend" "Thread pool / Executor" \
            "Signes de saturation de thread pool (RejectedExecutionException ou equivalent) dans les logs." \
            "Le code cree un Executors.newSingleThreadExecutor() par connexion SSE ouverte (voir MetricsController, LogSseService) sans jamais les fermer explicitement — si beaucoup de connexions SSE s'accumulent (onglets non fermes, reconnexions automatiques du navigateur), le nombre de threads OS augmente sans limite jusqu'a saturer la JVM ou l'OS, bloquant alors TOUTES les requetes, y compris les nouvelles pages qui chargent." \
            "grep -B2 -A5 'RejectedExecutionException' ${LOGFILE}"
    fi

    # Comptage de threads actifs vus dans un jstack si dispo, sinon juste heuristique via logs
    ASYNC_ERR=$(grep -cE '@Async|AsyncUncaughtExceptionHandler|TaskRejectedException' "${LOGFILE}" 2>/dev/null || echo 0)
    if [ "${ASYNC_ERR}" -gt 0 ]; then
        finding "WARNING" "Backend" "@Async" \
            "${ASYNC_ERR} occurrence(s) liees a @Async / TaskRejectedException dans les logs." \
            "Une tache @Async qui echoue silencieusement ou dont le pool dedie est sature peut bloquer les operations de deploiement (AppService utilise @Async pour ne pas bloquer le thread HTTP), avec un frontend qui attend indefiniment une reponse ou un statut qui ne se met jamais a jour." \
            "grep -B2 -A8 'TaskRejectedException' ${LOGFILE}"
    fi

    # Fabric8 / Kubernetes API client errors
    if grep -qiE 'KubernetesClientException|io\.fabric8|Operation: \[GET\]|Operation: \[POST\]|SocketTimeoutException.*[Kk]ube' "${LOGFILE}" 2>/dev/null; then
        finding "ERROR" "Backend" "Fabric8 KubernetesClient" \
            "Erreurs Fabric8/KubernetesClientException detectees dans les logs backend." \
            "Le backend est le SEUL composant a parler a l'API Kubernetes (via Fabric8). S'il bloque en attente d'une reponse de l'API server (timeout reseau, API server sature), le thread HTTP qui a initie cette action (deploiement, creation KafkaSource...) reste bloque, et si c'est un thread du pool Tomcat partage, ca peut affamer les autres requetes HTTP du frontend." \
            "grep -B3 -A15 'KubernetesClientException' ${LOGFILE} | head -100"
    fi

    # KnativeWatcher specifically (long-lived .watch())
    if grep -qiE 'KnativeWatcher|watch.*closed|WatcherException' "${LOGFILE}" 2>/dev/null; then
        finding "WARNING" "Backend" "KnativeWatcher (Fabric8 .watch())" \
            "Activite/erreurs liees au watcher Knative long-lived detectees." \
            "KnativeWatcher maintient une connexion .watch() ouverte en permanence vers l'API Kubernetes. Si cette connexion se coupe et se reconnecte en boucle (WatcherException), ca consomme un thread dedie en continu et peut saturer les connexions HTTP sortantes du pod backend vers l'API server, ce qui retarde toutes les autres operations Fabric8 (deploiement d'app, etc.)." \
            "grep -B2 -A10 'WatcherException' ${LOGFILE}"
    fi

    # SSE-specific errors
    if grep -qiE 'SseEmitter|AsyncRequestTimeoutException|ClientAbortException|Broken pipe' "${LOGFILE}" 2>/dev/null; then
        SSE_ERR_COUNT=$(grep -cE 'SseEmitter|AsyncRequestTimeoutException|ClientAbortException|Broken pipe' "${LOGFILE}")
        finding "WARNING" "Backend" "SSE (SseEmitter)" \
            "${SSE_ERR_COUNT} occurrence(s) d'erreurs liees aux flux SSE (AsyncRequestTimeoutException / ClientAbortException / Broken pipe)." \
            "Les emitters SSE de ce projet sont crees avec SseEmitter(0L) — timeout infini, sans heartbeat. Un client qui ferme son onglet sans que le serveur le detecte immediatement laisse un thread + une boucle while(true) tourner indefiniment cote backend, consommant un thread par connexion fantome jusqu'a saturation." \
            "grep -B2 -A5 'ClientAbortException' ${LOGFILE}"
    fi

    # Kafka client errors
    if grep -qiE 'org\.apache\.kafka|TimeoutException.*[Tt]opic|Failed to update metadata|NOT_LEADER' "${LOGFILE}" 2>/dev/null; then
        finding "ERROR" "Backend" "Kafka AdminClient / Producer" \
            "Erreurs client Kafka detectees dans les logs backend (org.apache.kafka.*)." \
            "Si les appels Kafka (AdminClient pour creer/lister/supprimer des topics) bloquent en attente d'une reponse du broker (deja constate : topic 'payments' bloque cote broker), et si ces appels sont synchrones sur le thread HTTP, chaque requete vers /kafka/** peut rester pendue jusqu'au timeout Kafka, bloquant ce thread pendant tout ce temps." \
            "grep -B2 -A10 'org.apache.kafka' ${LOGFILE} | tail -100"
    fi

    # Generic timeout / 502-503-504-ish signals
    if grep -qiE 'TimeoutException|Read timed out|Connection reset|EOFException' "${LOGFILE}" 2>/dev/null; then
        finding "WARNING" "Backend" "Timeouts reseau generiques" \
            "TimeoutException / Read timed out / Connection reset detectes dans les logs." \
            "Ces erreurs indiquent des appels sortants (vers Kubernetes API, Prometheus, Kafka, Keycloak, Stripe) qui ne recoivent pas de reponse a temps. Si ces appels sont faits de maniere synchrone/bloquante sur un thread partage, ils retardent ou bloquent toutes les autres requetes en attente de ce meme thread." \
            "grep -B2 -A5 'TimeoutException\\|Read timed out' ${LOGFILE} | tail -80"
    fi

    # Deadlock hints (rare but worth checking)
    if grep -qi 'deadlock' "${LOGFILE}" 2>/dev/null; then
        finding "CRITICAL" "Backend" "JVM" \
            "Le mot 'deadlock' apparait dans les logs backend." \
            "Un deadlock JVM bloque definitivement les threads impliques (souvent lies a un verrou partage entre deux operations, par exemple synchronisation autour du KnativeWatcher ou d'un cache partage) — ca explique un blocage permanent qui ne se resout que par redemarrage." \
            "kubectl exec ${BACKEND_POD} -n ${PLATFORM_NS} -- jstack 1 > threaddump.txt (lecture seule, ne redemarre rien)"
    fi

    # Try to get a live thread dump (read-only, does not kill/restart the JVM)
    echo ">> Tentative de thread dump JVM (jstack, lecture seule)..."
    kubectl exec "${BACKEND_POD}" -n "${PLATFORM_NS}" -- sh -c 'command -v jstack >/dev/null 2>&1 && jstack 1 || echo "jstack indisponible dans ce conteneur"' \
        > "${OUTDIR}/backend/threaddump.txt" 2>&1

    if grep -q "BLOCKED" "${OUTDIR}/backend/threaddump.txt" 2>/dev/null; then
        BLOCKED_COUNT=$(grep -c '"pool-\|"http-nio' "${OUTDIR}/backend/threaddump.txt" 2>/dev/null || echo 0)
        finding "CRITICAL" "Backend" "JVM Thread Dump" \
            "Des threads en etat BLOCKED sont presents dans le thread dump (jstack)." \
            "Des threads HTTP (http-nio-*) ou de pool (pool-*) bloques en attente d'un verrou (synchronized) expliquent directement des requetes qui ne repondent jamais — cause la plus probable et la plus precise du symptome 'pages bloquees en chargement'." \
            "grep -B5 'BLOCKED' ${OUTDIR}/backend/threaddump.txt"
    fi
    TOMCAT_THREADS=$(grep -c '"http-nio' "${OUTDIR}/backend/threaddump.txt" 2>/dev/null || echo 0)
    if [ "${TOMCAT_THREADS}" -gt 150 ]; then
        finding "WARNING" "Backend" "Tomcat thread pool" \
            "${TOMCAT_THREADS} threads http-nio-* presents dans le thread dump — nombre eleve." \
            "Un nombre anormalement eleve de threads Tomcat peut indiquer une accumulation de requetes qui n'aboutissent pas (chacune garde son thread), menant progressivement a l'epuisement du pool et donc a l'incapacite de traiter de nouvelles requetes du frontend." \
            "grep -c '\"http-nio' ${OUTDIR}/backend/threaddump.txt"
    fi
else
    echo "Pod backend (app=platform-api) introuvable dans le namespace ${PLATFORM_NS}." | tee "${OUTDIR}/backend/NOT_FOUND.txt"
    finding "ERROR" "Backend" "Pod platform-api" \
        "Aucun pod trouve avec le label app=platform-api dans le namespace ${PLATFORM_NS}." \
        "Sans backend joignable, aucune page du frontend ne peut charger de donnees — explique directement le blocage total observe." \
        "kubectl get pods -n ${PLATFORM_NS} -l app=platform-api"
fi

# ==========================================================================
# 4. FRONTEND (les deux portails)
# ==========================================================================
section "4. Frontend — web-portal et admin-console"

for app in platform-web platform-admin; do
    run "Pods ${app}" "${OUTDIR}/frontend/${app}-pods.txt" kubectl get pods -n "${PLATFORM_NS}" -l app="${app}" -o wide
    run "Describe ${app}" "${OUTDIR}/frontend/${app}-describe.txt" kubectl describe pods -n "${PLATFORM_NS}" -l app="${app}"
    run "Service ${app}" "${OUTDIR}/frontend/${app}-svc.txt" kubectl get svc "${app}" -n "${PLATFORM_NS}" -o yaml
    run "Endpoints ${app}" "${OUTDIR}/frontend/${app}-endpoints.txt" kubectl get endpoints "${app}" -n "${PLATFORM_NS}" -o yaml

    POD=$(kx get pods -n "${PLATFORM_NS}" -l app="${app}" -o jsonpath='{.items[0].metadata.name}')
    if [ -n "${POD:-}" ]; then
        run "Logs ${app}" "${OUTDIR}/frontend/${app}-logs.txt" kubectl logs "${POD}" -n "${PLATFORM_NS}" --tail=500

        if grep -qiE '502|503|504|Bad Gateway|Gateway Time-out|connect\(\) failed' "${OUTDIR}/frontend/${app}-logs.txt" 2>/dev/null; then
            finding "ERROR" "Frontend" "${app}" \
                "Erreurs 502/503/504 ou 'connect() failed' presentes dans les logs Nginx du pod ${app}." \
                "Nginx (qui sert le frontend) journalise ces erreurs quand il n'arrive pas a joindre le backend en amont (proxy_pass) — cause directe de pages qui restent bloquees en chargement, meme si l'operation Kubernetes elle-meme a reussi en arriere-plan." \
                "grep -E '502|503|504' ${OUTDIR}/frontend/${app}-logs.txt | tail -50"
        fi
    fi
done

# ==========================================================================
# 5. KAFKA / STRIMZI
# ==========================================================================
section "5. Kafka / Strimzi"

run "Pods kafka"          "${OUTDIR}/kafka/pods.txt"        kubectl get pods -n "${KAFKA_NS}" -o wide
run "Kafka CR"            "${OUTDIR}/kafka/kafka-cr.txt"     "kubectl get kafka -n ${KAFKA_NS} -o yaml"
run "KafkaTopic CRs"      "${OUTDIR}/kafka/kafkatopics.txt"  "kubectl get kafkatopic -n ${KAFKA_NS} -o wide"
run "StrimziPodSet"       "${OUTDIR}/kafka/strimzipodsets.txt" "kubectl get strimzipodset -n ${KAFKA_NS} -o wide"
run "Events kafka ns"     "${OUTDIR}/kafka/events.txt"      "kubectl get events -n ${KAFKA_NS} --sort-by=.lastTimestamp"

KAFKA_POD=$(kx get pods -n "${KAFKA_NS}" -l strimzi.io/name=my-cluster-kafka -o jsonpath='{.items[0].metadata.name}')
if [ -n "${KAFKA_POD:-}" ]; then
    run "Kafka broker logs"   "${OUTDIR}/kafka/broker-logs.txt" kubectl logs "${KAFKA_POD}" -n "${KAFKA_NS}" --tail=500
    run "Topics (kafka-topics.sh --list)" "${OUTDIR}/kafka/topics-list.txt" \
        "kubectl exec ${KAFKA_POD} -n ${KAFKA_NS} -- bin/kafka-topics.sh --bootstrap-server localhost:9092 --list"
    run "Consumer groups"     "${OUTDIR}/kafka/consumer-groups.txt" \
        "kubectl exec ${KAFKA_POD} -n ${KAFKA_NS} -- bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list"

    if grep -qiE 'NotLeaderOrFollowerException|NetworkException|broker may not be available' "${OUTDIR}/kafka/broker-logs.txt" 2>/dev/null; then
        finding "ERROR" "Kafka" "Broker ${KAFKA_POD}" \
            "Erreurs de disponibilite broker detectees (NotLeaderOrFollowerException / NetworkException)." \
            "Si le backend attend une reponse du broker Kafka pour une operation (creation/suppression de topic, publication d'evenement) et que le broker est instable, l'appel AdminClient peut bloquer jusqu'a son timeout, retardant la reponse HTTP correspondante et, si le thread est partage, d'autres requetes en attendant." \
            "grep -B2 -A10 'NotLeaderOrFollowerException' ${OUTDIR}/kafka/broker-logs.txt"
    fi

    # Consumer lag per group (best-effort, read-only)
    while read -r grp; do
        [ -z "$grp" ] && continue
        kubectl exec "${KAFKA_POD}" -n "${KAFKA_NS}" -- bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group "$grp" \
            >> "${OUTDIR}/kafka/consumer-lag.txt" 2>&1
        echo "---" >> "${OUTDIR}/kafka/consumer-lag.txt"
    done < "${OUTDIR}/kafka/consumer-groups.txt"

    if grep -qE '\s[0-9]{4,}\s' "${OUTDIR}/kafka/consumer-lag.txt" 2>/dev/null; then
        finding "WARNING" "Kafka" "Consumer groups" \
            "Un lag important (>= 1000, a verifier manuellement) est peut-etre present sur au moins un groupe — voir consumer-lag.txt." \
            "Un lag eleve peut indiquer un consumer bloque ou trop lent (ex : KafkaSource dispatcher), ce qui n'affecte pas directement le frontend mais confirme un ralentissement general du pipeline evenementiel a mentionner dans le diagnostic." \
            "cat ${OUTDIR}/kafka/consumer-lag.txt"
    fi
else
    echo "Pod broker Kafka introuvable (label strimzi.io/name=my-cluster-kafka)." > "${OUTDIR}/kafka/NOT_FOUND.txt"
fi

# ==========================================================================
# 6. KNATIVE SERVING + EVENTING (+ Kourier)
# ==========================================================================
section "6. Knative Serving / Eventing / Kourier"

run "Knative Serving pods"    "${OUTDIR}/knative/serving-pods.txt"   kubectl get pods -n "${KNATIVE_SERVING_NS}" -o wide
run "Knative Eventing pods"   "${OUTDIR}/knative/eventing-pods.txt"  kubectl get pods -n "${KNATIVE_EVENTING_NS}" -o wide
run "Kourier pods"            "${OUTDIR}/knative/kourier-pods.txt"   "kubectl get pods -n ${KOURIER_NS} -o wide || true"
run "Knative Services (all ns)" "${OUTDIR}/knative/ksvc-all.txt"     "kubectl get ksvc -A -o wide"
run "Knative Revisions (all ns)" "${OUTDIR}/knative/revisions-all.txt" "kubectl get revisions -A -o wide"
run "Brokers (all ns)"        "${OUTDIR}/knative/brokers-all.txt"    "kubectl get brokers -A -o wide"
run "Triggers (all ns)"       "${OUTDIR}/knative/triggers-all.txt"   "kubectl get triggers -A -o wide"
run "KafkaSources (all ns)"   "${OUTDIR}/knative/kafkasources-all.txt" "kubectl get kafkasources -A -o wide"

NOTREADY_KSVC=$(grep -v "^NAME" "${OUTDIR}/knative/ksvc-all.txt" 2>/dev/null | awk '$0 !~ /True/ && NF>0 {print}')
if [ -n "${NOTREADY_KSVC}" ]; then
    finding "WARNING" "Knative" "Knative Services" \
        "Au moins un Knative Service n'est pas Ready=True (voir ksvc-all.txt)." \
        "Un ksvc applicatif tenant non pret n'affecte pas directement les deux portails, mais peut provoquer des erreurs visibles cote frontend quand celui-ci interroge le statut de cette app precise — a differencier d'un vrai blocage global." \
        "kubectl get ksvc -A"
fi

run "Events knative-serving"  "${OUTDIR}/knative/serving-events.txt"  "kubectl get events -n ${KNATIVE_SERVING_NS} --sort-by=.lastTimestamp"
run "Events knative-eventing" "${OUTDIR}/knative/eventing-events.txt" "kubectl get events -n ${KNATIVE_EVENTING_NS} --sort-by=.lastTimestamp"

for f in "${OUTDIR}/knative/serving-pods.txt" "${OUTDIR}/knative/eventing-pods.txt"; do
    if grep -qE 'CrashLoopBackOff|Error|OOMKilled' "$f" 2>/dev/null; then
        finding "CRITICAL" "Knative" "$(basename "$f")" \
            "Pod(s) Knative en erreur/CrashLoopBackOff detecte(s)." \
            "Si le controller Knative (activator, autoscaler, controller) est instable, ca peut affecter la creation/mise a jour de ksvc declenchee depuis le portail — l'operation Kubernetes 'reussit' techniquement (CR cree) mais le suivi de statut cote frontend (qui poll le statut) ne se termine jamais correctement." \
            "kubectl describe pod -n knative-serving <nom-du-pod>"
    fi
done

# ==========================================================================
# 7. RESEAU — Cilium / NetworkPolicies / DNS
# ==========================================================================
section "7. Reseau — Cilium, NetworkPolicies, DNS"

run "Cilium pods"        "${OUTDIR}/network/cilium-pods.txt" kubectl get pods -n "${CILIUM_NS}" -l k8s-app=cilium -o wide
CILIUM_POD=$(kx get pods -n "${CILIUM_NS}" -l k8s-app=cilium -o jsonpath='{.items[0].metadata.name}')
if [ -n "${CILIUM_POD:-}" ]; then
    run "Cilium status" "${OUTDIR}/network/cilium-status.txt" \
        "kubectl exec -n ${CILIUM_NS} ${CILIUM_POD} -c cilium-agent -- cilium status --verbose"
    if grep -qiE 'unhealthy|failed|degraded' "${OUTDIR}/network/cilium-status.txt" 2>/dev/null; then
        finding "CRITICAL" "Reseau" "Cilium (${CILIUM_POD})" \
            "cilium status rapporte un etat unhealthy/failed/degraded." \
            "Cilium gere l'ensemble du reseau du cluster (y compris les regles NetworkPolicy d'isolation tenant). Une degradation reseau peut provoquer des connexions HTTP/SSE qui se coupent aleatoirement entre le frontend et le backend, ou entre le backend et l'API Kubernetes/Kafka, expliquant un blocage intermittent." \
            "kubectl exec -n ${CILIUM_NS} ${CILIUM_POD} -c cilium-agent -- cilium status --verbose"
    fi
fi

run "NetworkPolicies (all ns)" "${OUTDIR}/network/networkpolicies.txt" "kubectl get networkpolicy -A -o wide"
run "Describe NetworkPolicies platform" "${OUTDIR}/network/np-platform-describe.txt" \
    "kubectl describe networkpolicy -n ${PLATFORM_NS}"

# DNS check (read-only busybox exec, no resource created if already present; skip if not present)
run "CoreDNS pods"       "${OUTDIR}/network/coredns-pods.txt" kubectl get pods -n kube-system -l k8s-app=kube-dns -o wide
run "CoreDNS logs"       "${OUTDIR}/network/coredns-logs.txt" \
    "kubectl logs -n kube-system -l k8s-app=kube-dns --tail=200 --prefix"

if grep -qiE 'SERVFAIL|i/o timeout' "${OUTDIR}/network/coredns-logs.txt" 2>/dev/null; then
    finding "ERROR" "Reseau" "CoreDNS" \
        "SERVFAIL ou i/o timeout detecte dans les logs CoreDNS." \
        "Si la resolution DNS interne est instable, le backend peut echouer a resoudre postgres.platform.svc.cluster.local, keycloak.platform.svc.cluster.local, my-cluster-kafka-bootstrap.kafka.svc.cluster.local, etc. — bloquant alors toute operation qui en depend (donc quasiment tout, y compris l'authentification et l'affichage des pages)." \
        "kubectl logs -n kube-system -l k8s-app=kube-dns --tail=500"
fi

# ==========================================================================
# 8. RESSOURCES — top nodes/pods
# ==========================================================================
section "8. Consommation de ressources"

run "kubectl top nodes"  "${OUTDIR}/resources/top-nodes.txt" "kubectl top nodes || echo 'metrics-server indisponible'"
run "kubectl top pods -A" "${OUTDIR}/resources/top-pods.txt" "kubectl top pods -A --sort-by=cpu || echo 'metrics-server indisponible'"
run "kubectl top pods -A (memoire)" "${OUTDIR}/resources/top-pods-mem.txt" "kubectl top pods -A --sort-by=memory || echo 'metrics-server indisponible'"
run "df -h sur les nodes (via pods hostPath si dispo)" "${OUTDIR}/resources/disk-note.txt" \
    "echo 'Executer manuellement : ssh sur chaque VM puis df -h (non automatisable depuis kubectl seul)'"

# Flag pods using >80% of declared CPU/memory limit (best-effort text parsing)
if [ -s "${OUTDIR}/resources/top-pods.txt" ]; then
    HIGH_CPU=$(awk '$3+0 > 1000 {print}' "${OUTDIR}/resources/top-pods.txt" 2>/dev/null | head -10)
    if [ -n "$HIGH_CPU" ]; then
        finding "WARNING" "Ressources" "Pods (CPU eleve)" \
            "Pod(s) consommant plus de 1000m CPU au moment du scan (voir top-pods.txt)." \
            "Un pod backend qui sature son CPU (ex : boucle while(true) des flux SSE multiplies par de nombreuses connexions ouvertes) ralentit le traitement de toutes les requetes de ce pod, y compris celles du frontend qui attend une reponse." \
            "kubectl top pods -A --sort-by=cpu"
    fi
fi

NODE_MEM_HIGH=$(awk 'NR>1 {gsub(/%/,"",$5); if ($5+0 > 85) print}' "${OUTDIR}/resources/top-nodes.txt" 2>/dev/null)
if [ -n "$NODE_MEM_HIGH" ]; then
    finding "WARNING" "Ressources" "Nodes (memoire)" \
        "Au moins un node utilise plus de 85% de sa memoire (voir top-nodes.txt)." \
        "Une memoire quasi saturee sur un worker peut declencher des evictions de pods par le kubelet (y compris backend/frontend), coupant net des connexions en cours et provoquant le blocage observe." \
        "kubectl top nodes"
fi

# ==========================================================================
# 9. SSE / CONNEXIONS TEMPS REEL
# ==========================================================================
section "9. SSE / connexions temps reel"

if [ -n "${BACKEND_POD:-}" ]; then
    run "Connexions TCP ouvertes sur le pod backend (ss)" "${OUTDIR}/sse/backend-connections.txt" \
        "kubectl exec ${BACKEND_POD} -n ${PLATFORM_NS} -- sh -c 'command -v ss >/dev/null 2>&1 && ss -tn state established or ss -tn || echo ss-indisponible'"

    ESTABLISHED_COUNT=$(grep -c ESTAB "${OUTDIR}/sse/backend-connections.txt" 2>/dev/null || echo 0)
    if [ "${ESTABLISHED_COUNT}" -gt 100 ]; then
        finding "WARNING" "SSE" "Pod ${BACKEND_POD}" \
            "${ESTABLISHED_COUNT} connexions TCP ESTABLISHED sur le pod backend au moment du scan." \
            "Un nombre eleve de connexions etablies peut correspondre a des flux SSE jamais fermes proprement (onglets abandonnes, reconnexions du navigateur sans fermeture cote serveur) — chacune retient un thread dedie (Executors.newSingleThreadExecutor() par connexion dans MetricsController/LogSseService), ce qui finit par epuiser les threads disponibles pour repondre aux nouvelles requetes HTTP normales." \
            "kubectl exec ${BACKEND_POD} -n ${PLATFORM_NS} -- ss -tn state established | wc -l"
    fi

    if grep -qi "AsyncRequestTimeoutException" "${OUTDIR}/backend/logs.txt" 2>/dev/null; then
        finding "WARNING" "SSE" "SseEmitter" \
            "AsyncRequestTimeoutException present dans les logs — un emitter SSE a atteint un timeout." \
            "Meme si les emitters sont crees avec SseEmitter(0L) (timeout infini cote code), le conteneur servlet (Tomcat) applique parfois son propre spring.mvc.async.request-timeout par defaut — un conflit entre les deux peut fermer la connexion cote serveur sans que le frontend soit informe correctement, le laissant en attente." \
            "grep -B3 -A3 'AsyncRequestTimeoutException' ${OUTDIR}/backend/logs.txt"
    fi

    finding "INFO" "SSE" "Architecture" \
        "Rappel architecture (pas une erreur) : chaque connexion SSE (logs, metriques Monitoring) cree un Executors.newSingleThreadExecutor() dedie, jamais explicitement arrete (pas de emitter.onCompletion()/onTimeout() qui appelle shutdown() sur l'executor)." \
        "Ce point est une cause plausible de fuite de threads a moyen terme meme sans erreur visible immediate — a surveiller particulierement si le blocage survient apres une session d'utilisation prolongee avec plusieurs onglets/pages Monitoring ouvertes." \
        "grep -rn 'newSingleThreadExecutor' backend-api/src/main/java"
fi

# ==========================================================================
# 10. ELASTICSEARCH (si present — vu dans k8s/backup/elasticsearch-snapshot-cronjob.yaml)
# ==========================================================================
section "10. Elasticsearch (si deploye)"

ES_PODS=$(kx get pods -A -l app=elasticsearch -o wide 2>/dev/null)
if [ -n "$ES_PODS" ]; then
    run "Pods Elasticsearch" "${OUTDIR}/elasticsearch/pods.txt" kubectl get pods -A -l app=elasticsearch -o wide
    ES_POD=$(kx get pods -A -l app=elasticsearch -o jsonpath='{.items[0].metadata.name}')
    ES_NS=$(kx get pods -A -l app=elasticsearch -o jsonpath='{.items[0].metadata.namespace}')
    if [ -n "${ES_POD:-}" ]; then
        run "Logs Elasticsearch" "${OUTDIR}/elasticsearch/logs.txt" kubectl logs "${ES_POD}" -n "${ES_NS}" --tail=300
        if grep -qiE 'ClusterBlockException|circuit_breaking_exception|cluster_block_exception' "${OUTDIR}/elasticsearch/logs.txt" 2>/dev/null; then
            finding "WARNING" "Elasticsearch" "${ES_POD}" \
                "ClusterBlockException ou circuit_breaking_exception detecte." \
                "Si le backend interroge Elasticsearch de maniere synchrone (recherche/logs) et que le cluster ES est en lecture seule (disque plein) ou en circuit-breaker (memoire), ces appels peuvent bloquer ou echouer lentement, retardant les reponses HTTP correspondantes." \
                "grep -B2 -A5 'circuit_breaking_exception' ${OUTDIR}/elasticsearch/logs.txt"
        fi
    fi
else
    echo "Aucun pod avec le label app=elasticsearch trouve — composant probablement non deploye sur ce cluster ou label different." > "${OUTDIR}/elasticsearch/NOT_FOUND.txt"
    finding "INFO" "Elasticsearch" "Cluster" \
        "Aucun pod Elasticsearch detecte avec le label standard app=elasticsearch." \
        "Composant optionnel/backup selon k8s/backup/elasticsearch-snapshot-cronjob.yaml — si non deploye, il ne peut pas etre la cause du blocage. A verifier manuellement si un autre label est utilise." \
        "kubectl get pods -A | grep -i elastic"
fi

# ==========================================================================
# 11. MONITORING STACK (Prometheus / Alertmanager) — sante uniquement
# ==========================================================================
section "11. Monitoring stack (Prometheus / Alertmanager) — sante"

run "Pods monitoring"     "${OUTDIR}/cluster/monitoring-pods.txt" "kubectl get pods -n ${MONITORING_NS} -o wide || true"
run "Events monitoring"   "${OUTDIR}/cluster/monitoring-events.txt" "kubectl get events -n ${MONITORING_NS} --sort-by=.lastTimestamp || true"

if grep -qE 'CrashLoopBackOff|Error|OOMKilled' "${OUTDIR}/cluster/monitoring-pods.txt" 2>/dev/null; then
    finding "WARNING" "Monitoring" "Prometheus/Alertmanager" \
        "Pod(s) du stack monitoring en erreur." \
        "Si Prometheus est down, les appels PromQL du backend (MetricsService) echouent en timeout au lieu de repondre vite avec une erreur claire — ca peut ralentir les pages Dashboard/Monitoring du frontend sans forcement les bloquer completement (a differencier d'un blocage total)." \
        "kubectl describe pods -n ${MONITORING_NS}"
fi

# ==========================================================================
# RESUME FINAL
# ==========================================================================
{
    echo ""
    echo "## Resume"
    echo ""
    echo "| Niveau | Nombre |"
    echo "|---|---|"
    echo "| CRITICAL | ${CRIT_COUNT} |"
    echo "| ERROR    | ${ERR_COUNT} |"
    echo "| WARNING  | ${WARN_COUNT} |"
    echo "| INFO     | ${INFO_COUNT} |"
    echo ""
    if [ "${CRIT_COUNT}" -gt 0 ]; then
        echo "**Des problemes CRITICAL ont ete detectes — voir les sections correspondantes ci-dessus en priorite.**"
    elif [ "${ERR_COUNT}" -gt 0 ]; then
        echo "**Aucun CRITICAL, mais des ERROR sont presents — a examiner.**"
    else
        echo "Aucun CRITICAL ni ERROR detecte automatiquement. Se referer aux WARNING/INFO et notamment a la section Thread Dump et SSE (§3, §9) qui necessitent souvent une lecture manuelle plus fine."
    fi
} >> "${REPORT}"

# ==========================================================================
# ARCHIVAGE
# ==========================================================================
tar -czf "${OUTDIR}.tar.gz" "${OUTDIR}"

echo ""
echo "=============================================================="
echo " Diagnostic termine."
echo " Rapport      : ${REPORT}"
echo " Archive      : ${OUTDIR}.tar.gz"
echo " CRITICAL=${CRIT_COUNT}  ERROR=${ERR_COUNT}  WARNING=${WARN_COUNT}  INFO=${INFO_COUNT}"
echo "=============================================================="
