# Mettre EduPilot en ligne sur un VPS (Contabo, OVH…)

Guide pas à pas, du VPS neuf à l'application en HTTPS. Compter environ
**1 heure**, dont 15 minutes d'attente (construction de l'image).

Ce que vous obtenez : EduPilot et sa base sur une seule machine, HTTPS
automatique, pare-feu, mises à jour de sécurité automatiques, sauvegarde
chiffrée chaque nuit et maintenance quotidienne.

---

## 1. Ce qu'il faut avant de commencer

| Élément | Choix conseillé | Coût indicatif |
|---|---|---|
| VPS | **4 vCPU, 8 Go de RAM**, Ubuntu **24.04**, région Allemagne (Contabo « Cloud VPS ») ou France (OVH « VPS-1 ») | ≈ 5 €/mois |
| Nom de domaine | un `.com` ou le domaine de l'école (ex. `app.mon-ecole.bj`) | ≈ 10 €/an |
| DNS | **Cloudflare** (gratuit) | 0 |
| Clé SSH | générée sur votre ordinateur : `ssh-keygen -t ed25519` | 0 |

**Commande Contabo — pour éviter un blocage :** commander à votre vrai nom,
avec l'adresse de votre carte bancaire, **sans VPN**, et garder sous la main
pièce d'identité et justificatif de domicile (Contabo peut les demander après
le paiement). Commencer par **1 mois** limite la perte en cas de refus.

**Données d'élèves hébergées hors du Bénin :** l'autorisation préalable de
l'APDP est requise (art. 391 du Code du numérique) — voir
`docs/conformite/APDP_DOSSIER.md`.

## 2. Commander le VPS

1. Choisir l'offre (4 vCPU / 8 Go), la région, l'image **Ubuntu 24.04**.
2. Coller votre **clé publique SSH** (`~/.ssh/id_ed25519.pub`) à la commande.
3. Noter l'**adresse IP** reçue par e-mail.

## 3. Faire pointer le domaine vers le VPS

Dans Cloudflare (ou chez votre registraire) : enregistrement **A**
`app` → adresse IP du VPS, **proxy désactivé (nuage gris)** pour le premier
démarrage, le temps que Caddy obtienne le certificat HTTPS.

Vérifier depuis votre ordinateur : `ping app.mon-ecole.bj` doit répondre
avec l'adresse du VPS.

## 4. Installer EduPilot

Sur votre ordinateur :

```bash
ssh root@ADRESSE_IP
```

Sur le VPS :

```bash
apt-get update && apt-get install -y git
git clone <adresse-de-votre-dépôt> /opt/edupilot
cd /opt/edupilot
sudo bash deploy/contabo/install.sh app.mon-ecole.bj
```

Dépôt privé : ajouter d'abord une **clé de déploiement** en lecture seule
(GitHub › Settings › Deploy keys) avec une clé SSH générée sur le VPS.

Le script (rejouable sans risque) :
1. active les mises à jour de sécurité automatiques, le pare-feu (SSH, 80,
   443 seulement) et fail2ban ;
2. installe Docker (dépôt officiel) ;
3. crée `/opt/edupilot/.env` avec des secrets générés ;
4. démarre PostgreSQL, crée le **rôle applicatif soumis à la RLS**,
   construit et démarre l'application derrière **Caddy (HTTPS automatique)** ;
5. programme la **sauvegarde chiffrée** (2 h) et la **maintenance** (6 h).

⚠️ **Copiez tout de suite, hors du serveur** (gestionnaire de mots de passe) :
`/opt/edupilot/.env` et `/etc/edupilot/backup.key`. Sans eux, aucune
sauvegarde ne peut être restaurée et les secrets chiffrés sont perdus.

## 5. Premier compte

```bash
cd /opt/edupilot
docker compose -f docker-compose.yml -f deploy/contabo/docker-compose.prod.yml logs app | grep -i "jeton d'installation"
```

Ouvrir `https://app.mon-ecole.bj/setup`, saisir le jeton, créer le compte
super-administrateur.

## 6. Régler les intégrations (console root › Intégrations)

1. **E-mail** : Brevo (gratuit, 300/jour) en SMTP :
   `smtp://IDENTIFIANT:CLÉ@smtp-relay.brevo.com:587`, adresse d'expédition
   vérifiée chez Brevo → bouton **« Envoyer un e-mail d'essai »**.
2. **WhatsApp (canal principal)** : suivre `docs/EXPLOITATION.md` §7 bis
   (application Meta, modèles, webhook) → **« Envoyer un WhatsApp d'essai »**.
3. **SMS (secours)** : passerelle de votre fournisseur.

## 7. Sauvegardes hors du serveur (indispensable)

La sauvegarde de 2 h reste **sur le VPS** : si la machine disparaît, elle
disparaît avec. Copier chaque nuit les fichiers chiffrés ailleurs, par
exemple avec **rclone** vers un stockage gratuit (Google Drive 15 Go,
stockage objet gratuit d'Oracle Cloud…) :

```bash
apt-get install -y rclone
sudo -u edupilot rclone config        # créer une destination nommée « distant »
echo '30 3 * * * edupilot rclone copy /var/backups/edupilot/postgres distant:edupilot-sauvegardes --max-age 48h >> /var/log/edupilot/offsite.log 2>&1' \
  | sudo tee /etc/cron.d/edupilot-offsite
```

Les fichiers sont déjà chiffrés (AES-256) : la destination ne voit rien.
**Tester une restauration** au moins une fois : `docs/EXPLOITATION.md` §4.

## 8. Mettre à jour

```bash
cd /opt/edupilot && git pull
docker compose -f docker-compose.yml -f deploy/contabo/docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f deploy/contabo/docker-compose.prod.yml exec -T postgres \
  psql -q -U edupilot -d edupilot -v app_password="$(grep ^APP_DB_PASSWORD .env | cut -d= -f2)" -v owner=edupilot \
  -f - < deploy/contabo/app-role.sql
```

Les migrations s'appliquent seules au démarrage ; la dernière commande donne
au rôle applicatif les droits sur les nouvelles tables.

## 9. Surveiller

| Question | Commande |
|---|---|
| Tout tourne ? | `docker compose -f docker-compose.yml -f deploy/contabo/docker-compose.prod.yml ps` (colonne STATUS : `healthy`) |
| L'app répond ? | `curl -s https://app.mon-ecole.bj/api/health` |
| Erreurs récentes | `… logs --tail 100 app` |
| Sauvegarde de la nuit | `tail /var/log/edupilot/backup.log` |
| Disque | `df -h /` (alerte à 80 %) |

Le journal des erreurs et les alertes sont aussi visibles dans la console
root (Supervision).

## 10. Ce que ça coûte (1 à 4 écoles)

| Poste | Coût annuel |
|---|---|
| VPS 4 vCPU / 8 Go | ≈ 60 € (≈ 40 000 FCFA) |
| Domaine | ≈ 10 € |
| HTTPS, DNS, e-mail (Brevo), sauvegarde distante | 0 |
| WhatsApp (≈ 2,4 FCFA par message utilitaire) | selon l'usage |
| SMS de secours | selon l'usage et la passerelle |
