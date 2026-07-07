# Sauvegarde & reprise après sinistre (P2.8)

## Vue d'ensemble

| Composant | Mécanisme | Fréquence | Rétention |
|---|---|---|---|
| PostgreSQL (`platformserverless`) | `pg_dump` → gzip → upload S3-compatible | Quotidien à 02h30 | 7 quotidiens + 4 hebdomadaires (dimanche) |
| Elasticsearch | Snapshot natif vers un repository S3 | Quotidien à 03h00 | 7 quotidiens + 4 hebdomadaires (dimanche) |

Provider de stockage : **S3-compatible générique** (AWS S3, MinIO, OVH, Scaleway, Backblaze B2, ...)
— configuré via `AWS_ENDPOINT_URL`, jamais figé sur un provider précis.

## Mise en place (une seule fois)

### 1. Créer le bucket et les identifiants
Créez un bucket (ex. `platformserverless-backups`) chez votre provider S3-compatible, et une paire
de clés d'accès avec droits lecture/écriture dessus uniquement.

### 2. Créer le secret Kubernetes
```bash
cp k8s/backup/backup-secret.example.yaml k8s/backup/backup-secret.yaml
# éditer backup-secret.yaml avec les vraies valeurs — NE JAMAIS committer ce fichier rempli
kubectl apply -f k8s/backup/backup-secret.yaml
```

### 3. Déployer les CronJobs
```bash
kubectl apply -f k8s/backup/postgres-backup-cronjob.yaml
kubectl apply -f k8s/backup/elasticsearch-snapshot-cronjob.yaml
```

### 4. Enregistrer le repository de snapshot Elasticsearch (une fois)
Nécessite le plugin `repository-s3` installé sur le cluster ES :
```bash
curl -X PUT "http://elasticsearch.platform.svc.cluster.local:9200/_snapshot/platform-backups" \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "s3",
    "settings": {
      "bucket": "platformserverless-backups",
      "endpoint": "s3.REPLACE_ME.example.com",
      "base_path": "elasticsearch"
    }
  }'
```

## Vérifier qu'une sauvegarde a bien eu lieu
```bash
kubectl get cronjobs -n platform
kubectl get jobs -n platform -l job-name=postgres-backup
kubectl logs -n platform job/<nom-du-job>
```

## Procédure de restauration — PostgreSQL

1. Télécharger le dump voulu :
   ```bash
   aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp \
     s3://platformserverless-backups/postgres/daily/pg-platformserverless-2026-07-06.sql.gz .
   gunzip pg-platformserverless-2026-07-06.sql.gz
   ```
2. **Arrêter le backend** (`kubectl scale deployment platform-api -n platform --replicas=0`) pour
   éviter des écritures concurrentes pendant la restauration.
3. Restaurer dans une base vide (ou une base de secours renommée, pour comparaison avant bascule) :
   ```bash
   psql -h postgres.platform.svc.cluster.local -U postgres -d platformserverless \
     -f pg-platformserverless-2026-07-06.sql
   ```
4. Redémarrer le backend (`kubectl scale deployment platform-api -n platform --replicas=1`).
5. Vérifier `/actuator/health` et quelques endpoints clés (`/api/admin/stats`) avant de rouvrir le
   trafic aux clients.

## Procédure de restauration — Elasticsearch

1. Lister les snapshots disponibles :
   ```bash
   curl "http://elasticsearch.platform.svc.cluster.local:9200/_snapshot/platform-backups/_all"
   ```
2. Fermer les indices concernés (ou tout restaurer dans un cluster vide) :
   ```bash
   curl -X POST "http://elasticsearch.platform.svc.cluster.local:9200/_all/_close"
   ```
3. Restaurer le snapshot choisi :
   ```bash
   curl -X POST "http://elasticsearch.platform.svc.cluster.local:9200/_snapshot/platform-backups/daily-2026-07-06-0300/_restore"
   ```
4. Rouvrir les indices et vérifier que les logs/métriques réapparaissent dans l'admin.

## À tester régulièrement

Cette procédure doit être exécutée **au moins une fois par trimestre sur un environnement de test**
(jamais uniquement en cas de sinistre réel) pour s'assurer que :
- les identifiants S3 sont toujours valides,
- les dumps ne sont pas corrompus,
- le temps de restauration réel est connu et documenté ici.
