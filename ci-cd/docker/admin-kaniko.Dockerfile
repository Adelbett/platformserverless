# Kaniko variant (mirrors ci-cd/docker/frontend-kaniko.Dockerfile) — expects
# `dist/` to already be built by the Jenkins pipeline before the kaniko
# context is sent (see ci-cd/jenkins/pipelines/Jenkinsfile.admin).
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY dist .
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
