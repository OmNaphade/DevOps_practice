# GKE Deployment

Replace these values before running the commands:

```powershell
$PROJECT_ID = "your-gcp-project-id"
$REGION = "asia-south1"
$REPOSITORY = "static-sites"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/interview-hub:latest"
```

Build and push the container image:

```powershell
gcloud auth configure-docker "$REGION-docker.pkg.dev"
gcloud artifacts repositories create $REPOSITORY --repository-format=docker --location=$REGION
docker build -t $IMAGE .
docker push $IMAGE
```

Update `k8s/deployment.yaml` and replace:

```text
REPLACE_WITH_ARTIFACT_REGISTRY_IMAGE
```

with the value of `$IMAGE`.

Deploy to GKE:

```powershell
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl get service interview-hub
```

Use the `EXTERNAL-IP` from the service once it is assigned.
