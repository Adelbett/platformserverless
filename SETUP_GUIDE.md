# 🛠️ Setup Guide - Backend API Project

**Status:** ⚠️ Environment Setup Required

---

## 📋 Prerequisites

Votre projet a été restructuré avec succès, mais l'environnement de développement n'est pas encore configuré.

### Required Software

1. **Java 21 (JDK)**
   - **Required for:** Compiling and running Spring Boot application
   - **Download:** https://www.oracle.com/java/technologies/downloads/#java21
   - **Or:** https://adoptium.net/temurin/releases/?version=21

2. **Maven 3.9.6+**
   - **Required for:** Building the project
   - **Download:** https://maven.apache.org/download.cgi
   - **Or:** Use the Maven wrapper (already included in this project)

3. **Docker & Docker Compose** (for local development)
   - **Optional but recommended**
   - **Download:** https://www.docker.com/products/docker-desktop

---

## ⚙️ Windows Setup Instructions

### Step 1: Install Java 21

1. Download Java 21 from Oracle or Adoptium
2. Run the installer and follow the instructions
3. Note the installation path (e.g., `C:\Program Files\Java\jdk-21.0.x`)

4. Set JAVA_HOME environment variable:
   ```powershell
   # Open PowerShell as Administrator
   [Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-21.0.x", "Machine")
   [Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$env:JAVA_HOME\bin", "Machine")
   ```

5. Verify installation:
   ```bash
   java -version
   javac -version
   ```

### Step 2: Setup Maven (Optional - Project has wrapper)

**Option A: Use Maven Wrapper (Already Configured)**
```bash
cd c:\Users\Hassen\.gemini\antigravity\scratch\platformserverless\backend-api
.\mvnw.bat --version
```

**Option B: Install Maven Globally**
1. Download Maven 3.9.6: https://maven.apache.org/download.cgi
2. Extract to a folder (e.g., `C:\Maven\apache-maven-3.9.6`)
3. Set MAVEN_HOME:
   ```powershell
   [Environment]::SetEnvironmentVariable("MAVEN_HOME", "C:\Maven\apache-maven-3.9.6", "Machine")
   [Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$env:MAVEN_HOME\bin", "Machine")
   ```

4. Verify installation:
   ```bash
   mvn --version
   ```

---

## 🚀 Build & Run Project

Once Java and Maven are installed:

### Build the Project
```bash
cd c:\Users\Hassen\.gemini\antigravity\scratch\platformserverless\backend-api

# Using Maven wrapper (no Maven installation needed)
.\mvnw.bat clean install

# Or using globally installed Maven
mvn clean install
```

### Start Local Services (Optional)
```bash
docker-compose up -d
# Starts: PostgreSQL, Redis, Prometheus
```

### Run the Application
```bash
# Using Maven wrapper
.\mvnw.bat spring-boot:run

# Or using globally installed Maven
mvn spring-boot:run
```

### Access the API
- **Main API:** http://localhost:8080
- **Swagger UI:** http://localhost:8080/swagger-ui.html
- **Health Check:** http://localhost:8080/actuator/health

---

## 📝 Maven Commands Reference

```bash
# Clean and compile
.\mvnw.bat clean compile

# Run tests
.\mvnw.bat test

# Build JAR
.\mvnw.bat clean package

# Run application
.\mvnw.bat spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=dev"

# Skip tests during build
.\mvnw.bat clean package -DskipTests

# Build Docker image
docker build -t platform-backend:latest .

# Show dependency tree
.\mvnw.bat dependency:tree
```

---

## 🐛 Troubleshooting

### Error: "JAVA_HOME is not set"
**Solution:** Set JAVA_HOME environment variable to your JDK installation path
```bash
set JAVA_HOME=C:\Program Files\Java\jdk-21.0.x
```

### Error: "java.lang.UnsupportedClassVersionError"
**Solution:** Make sure Java 21 is installed (not Java 11 or below)
```bash
java -version  # Should show Java 21
```

### Error: "No plugin found for prefix 'spring-boot'"
**Solution:** Run `mvn clean` first to refresh plugins
```bash
.\mvnw.bat clean
.\mvnw.bat compile
```

### Error: "Cannot connect to database"
**Solution:** Start Docker services
```bash
cd c:\Users\Hassen\.gemini\antigravity\scratch\platformserverless\backend-api
docker-compose up -d
```

---

## ✅ Project Status After Restructuring

### Architecture
- ✅ Feature-based (vertical slice) organization implemented
- ✅ All entities moved to feature packages
- ✅ All repositories moved to feature packages
- ✅ All imports updated
- ✅ Old entity/ and repository/ folders removed

### Files Ready
- ✅ pom.xml configured (Spring Boot 3.2.3, Java 21)
- ✅ application.yml ready
- ✅ docker-compose.yml ready for local development
- ✅ Dockerfile configured for production builds
- ✅ Maven wrapper configured (mvnw, mvnw.bat)

### Next Steps
1. ✅ Install Java 21
2. ✅ Install Maven 3.9.6+ (or use wrapper)
3. ⏳ Run `mvn clean install` to build
4. ⏳ Run `mvn spring-boot:run` to start
5. ⏳ Test API on http://localhost:8080/swagger-ui.html

---

## 🔗 Useful Links

- **Spring Boot Docs:** https://spring.io/projects/spring-boot
- **Maven Docs:** https://maven.apache.org/guides/
- **Java 21 Docs:** https://docs.oracle.com/en/java/javase/21/
- **Docker Docs:** https://docs.docker.com/
- **Kubernetes Docs:** https://kubernetes.io/docs/
- **Knative Docs:** https://knative.dev/docs/

---

## 💾 Project Structure (After Restructuring)

```
backend-api/
├── src/main/java/com/platform/api/
│   ├── user/              [Feature: User Management]
│   ├── app/               [Feature: App Deployment]
│   ├── metrics/           [Feature: Metrics]
│   ├── logs/              [Feature: Logging]
│   ├── auth/              [Feature: Authentication]
│   ├── eventing/          [Feature: Events]
│   ├── security/          [Cross-cutting: Security]
│   ├── exception/         [Cross-cutting: Error Handling]
│   ├── config/            [Cross-cutting: Configuration]
│   ├── deployment/        [Feature: Deployment]
│   ├── kafka/             [Feature: Kafka]
│   └── BackendApiApplication.java
├── .mvn/wrapper/          [Maven Wrapper Configuration]
├── mvnw                   [Maven Wrapper (Linux/Mac)]
├── mvnw.bat               [Maven Wrapper (Windows)]
├── pom.xml                [Maven Configuration]
├── Dockerfile             [Docker Image]
├── docker-compose.yml     [Local Development Stack]
└── application.yml        [Application Configuration]
```

---

## 📞 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review error messages carefully
3. Make sure JAVA_HOME and MAVEN_HOME are set correctly
4. Verify all prerequisites are installed
5. Run `mvn clean` and try again

---

**Generated:** March 31, 2026  
**Project:** Serverless Platform Backend API v1.0.0  
**Architecture:** Feature-Based (Spring Boot 3.2.3, Java 21)
