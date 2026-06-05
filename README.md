# Interview Hub

Interview Hub is a static question-bank website for Java theory and coding interview practice.

The app is plain HTML, CSS, JavaScript, and JSON. There is no backend server and no build step.

## Project Structure

```text
.
|-- index.html              # Main page
|-- assets/
|   |-- app.css             # Styles
|   `-- app.js              # Browser logic
|-- data-theory.json        # Theory questions
|-- data-coding.json        # Coding questions
|-- templates/              # JSON templates for adding content
|-- values/                 # Supporting static data
|-- Dockerfile              # nginx container for the static site
|-- k8s/
|   |-- deployment.yaml     # Kubernetes/GKE Deployment
|   `-- service.yaml        # Public LoadBalancer Service
`-- .dockerignore           # Files excluded from Docker image builds
```

## How It Works

`index.html` loads the CSS and JavaScript from `assets/`.

`assets/app.js` fetches the JSON data files and renders the theory and coding sections in the browser.

Because everything is static, the same files can run locally, inside Docker, or on GKE behind nginx.

## Run Locally

For a quick preview, open `index.html` in a browser.

For a container preview:

```powershell
docker build -t interview-hub-static .
docker run --rm -p 8080:80 interview-hub-static
```

Then open:

```text
http://localhost:8080
```

## Docker Flow

The `Dockerfile` uses `nginx:alpine`.

It copies the static files into:

```text
/usr/share/nginx/html/
```

nginx serves the site on port `80`.

## GKE Flow

1. Build the Docker image.
2. Push it to Google Artifact Registry.
3. Replace the image placeholder in `k8s/deployment.yaml`.
4. Apply the Kubernetes YAML files.
5. Open the external IP created by the LoadBalancer service.

Example variables:

```powershell
$PROJECT_ID = "your-gcp-project-id"
$REGION = "asia-south1"
$REPOSITORY = "static-sites"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/interview-hub:latest"
```

Build and push:

```powershell
gcloud auth configure-docker "$REGION-docker.pkg.dev"
gcloud artifacts repositories create $REPOSITORY --repository-format=docker --location=$REGION
docker build -t $IMAGE .
docker push $IMAGE
```

Update `k8s/deployment.yaml`:

```yaml
image: REPLACE_WITH_ARTIFACT_REGISTRY_IMAGE
```

Replace it with your Artifact Registry image URL.

Deploy:

```powershell
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl get service interview-hub
```

When `EXTERNAL-IP` is assigned, open it in the browser.

## Notes

The page currently loads Prism and Google Fonts from external CDNs. The deployed site needs internet access for those resources unless they are downloaded and served locally.
