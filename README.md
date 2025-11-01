# Welcome to your Dyad app

This application is a full-stack React and Fastify project, designed to help you share your journeys.

## Running with Docker Compose (Published Image)

To get the application up and running quickly using pre-built Docker images:

1.  **Ensure Docker is installed:** Make sure you have Docker and Docker Compose installed on your system.
2.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-name>
    ```
3.  **Start the services:**
    ```bash
    docker compose up -d
    ```
    This command will pull the necessary images (PostgreSQL and the application) and start the services in detached mode.
4.  **Access the application:** Once the services are up, you can access the frontend in your browser at `http://localhost:8080`.

## Building and Running Locally with Docker Compose

If you want to build the Docker image for the application locally (e.g., for development or custom changes):

1.  **Ensure Docker is installed:** Make sure you have Docker and Docker Compose installed on your system.
2.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-name>
    ```
3.  **Build the application image:**
    ```bash
    docker compose build
    ```
    This command will build the `app` service image using the `Dockerfile` in the root directory.
4.  **Start the services:**
    ```bash
    docker compose up -d
    ```
    This will start the PostgreSQL database and your locally built application image.
5.  **Access the application:** Once the services are up, you can access the frontend in your browser at `http://localhost:8080`.

### Important Notes:

*   **Environment Variables:** The `docker-compose.yml` file sets up necessary environment variables like `DATABASE_URL` and `JWT_SECRET`. For local development, you might also use a `.env` file (which is ignored by Git) for additional local-specific configurations.
*   **Data Persistence:** The `db_data` volume ensures that your PostgreSQL data persists even if you stop or remove the containers.
*   **Uploads:** The `./backend/uploads` directory is mounted into the container to persist any uploaded media files.