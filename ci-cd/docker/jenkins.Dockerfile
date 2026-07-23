FROM jenkins/jenkins:lts-jdk17

USER root

# Install Java 21
RUN apt-get update && apt-get install -y wget curl git coreutils nodejs npm && \
    wget -q https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.3_9.tar.gz -O /tmp/jdk21.tar.gz && \
    tar -xzf /tmp/jdk21.tar.gz -C /opt/ && \
    mv /opt/jdk-21.0.3+9 /opt/java21 && \
    rm /tmp/jdk21.tar.gz

# Install Kaniko
COPY --from=gcr.io/kaniko-project/executor:debug /kaniko/executor /kaniko/executor
RUN chmod +x /kaniko/executor

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/kubectl

# Increase open file descriptor limit for Jenkins JVM
# Default 1024 is too low: Jenkins + Kaniko builds exhaust FDs → jspawnhelper fails
RUN echo "jenkins soft nofile 65536\njenkins hard nofile 65536" >> /etc/security/limits.conf && \
    echo "session required pam_limits.so" >> /etc/pam.d/common-session

USER jenkins

ENV JAVA_OPTS="-Xmx1g -Xms512m \
  -Djava.io.tmpdir=/var/jenkins_home/tmp \
  -Djna.tmpdir=/var/jenkins_home/jna \
  -Dorg.jenkinsci.plugins.durabletask.BourneShellScript.HEARTBEAT_CHECK_INTERVAL=86400"
