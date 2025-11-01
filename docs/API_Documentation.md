# Matka API Documentation

This document provides a comprehensive overview of the Matka backend API endpoints. The API is built with Fastify and uses PostgreSQL as its database. Authentication is handled via JWT tokens for most protected routes.

**Base URL:** `/api` (e.g., `http://localhost:8080/api`)

---

## Table of Contents

1.  [Health Check](#1-health-check)
2.  [Authentication & Public User Routes](#2-authentication--public-user-routes)
    *   [Check if Users Exist](#check-if-users-exist)
    *   [Register Admin User](#register-admin-user)
    *   [Login User](#login-user)
3.  [Protected User Routes](#3-protected-user-routes)
    *   [Get Current User Profile](#get-current-user-profile)
    *   [Update Current User Profile](#update-current-user-profile)
    *   [Admin: Get All Users](#admin-get-all-users)
    *   [Admin: Create New User](#admin-create-new-user)
    *   [Admin: Update User by ID](#admin-update-user-by-id)
    *   [Admin: Reset User Password](#admin-reset-user-password)
    *   [Admin: Delete User by ID](#admin-delete-user-by-id)
    *   [Search Users](#search-users)
4.  [Journey Routes](#4-journey-routes)
    *   [Get User's Journeys](#get-users-journeys)
    *   [Admin: Get All Journeys](#admin-get-all-journeys)
    *   [Create New Journey](#create-new-journey)
    *   [Update Journey Details](#update-journey-details)
    *   [Publish Journey](#publish-journey)
    *   [Unpublish Journey](#unpublish-journey)
    *   [Set/Update Journey Passphrase](#setupdate-journey-passphrase)
    *   [Clear Journey Passphrase](#clear-journey-passphrase)
    *   [Delete Journey](#delete-journey)
    *   [Get Journey Collaborators](#get-journey-collaborators)
    *   [Add Journey Collaborator](#add-journey-collaborator)
    *   [Update Collaborator Permissions](#update-collaborator-permissions)
    *   [Remove Collaborator](#remove-collaborator)
5.  [Post Routes](#5-post-routes)
    *   [Get Posts for a Journey](#get-posts-for-a-journey)
    *   [Create New Post](#create-new-post)
    *   [Update Post](#update-post)
    *   [Delete Post](#delete-post)
6.  [Media Routes](#6-media-routes)
    *   [Upload Media](#upload-media)
7.  [Public Journey Access](#7-public-journey-access)
    *   [Access Public Journey by Link ID](#access-public-journey-by-link-id)

---

## 1. Health Check

**`GET /health`**

Checks the health of the API server.

*   **Authentication:** None
*   **Response:**
    *   `200 OK`
        ```json
        {
          "status": "ok"
        }
        ```

---

## 2. Authentication & Public User Routes

These routes do not require a JWT token.

### Check if Users Exist

**`GET /users/exists`**

Checks if any users exist in the database. This is used during initial setup to determine if the registration dialog for the first admin should be shown.

*   **Authentication:** None
*   **Response:**
    *   `200 OK`
        ```json
        {
          "exists": true
        }
        ```
        or
        ```json
        {
          "exists": false
        }
        ```
    *   `500 Internal Server Error`
        ```json
        {
          "message": "Internal server error: Could not check user existence."
        }
        ```

### Register Admin User

**`POST /register`**

Registers the first user as an administrator. Subsequent registrations will be handled by an admin.

*   **Authentication:** None
*   **Request Body:**
    ```json
    {
      "username": "admin_username",
      "password": "admin_password"
    }
    ```
*   **Response:**
    *   `200 OK`
        ```json
        {
          "user": {
            "id": "uuid-string",
            "username": "admin_username",
            "isAdmin": true,
            "name": null,
            "surname": null,
            "profile_image_url": null,
            "language": "en",
            "created_at": "ISO-date-string"
          },
          "token": "jwt-token-string"
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "Username and password are required"
        }
        ```
    *   `409 Conflict`
        ```json
        {
          "message": "Username already exists"
        }
        ```
    *   `500 Internal Server Error`
        ```json
        {
          "message": "Internal server error during registration."
        }
        ```

### Login User

**`POST /login`**

Authenticates a user and returns a JWT token and user details.

*   **Authentication:** None
*   **Request Body:**
    ```json
    {
      "username": "user_username",
      "password": "user_password"
    }
    ```
*   **Response:**
    *   `200 OK`
        ```json
        {
          "user": {
            "id": "uuid-string",
            "username": "user_username",
            "isAdmin": false,
            "name": "John",
            "surname": "Doe",
            "profile_image_url": "url-to-image",
            "language": "en",
            "created_at": "ISO-date-string"
          },
          "token": "jwt-token-string"
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "Username and password are required"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Invalid credentials"
        }
        ```
    *   `500 Internal Server Error`
        ```json
        {
          "message": "Internal server error during login."
        }
        ```

---

## 3. Protected User Routes

These routes require a valid JWT token in the `Authorization: Bearer <token>` header.

### Get Current User Profile

**`GET /users/profile`**

Retrieves the profile details of the authenticated user.

*   **Authentication:** Required
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "uuid-string",
          "username": "current_user",
          "isAdmin": false,
          "name": "Current",
          "surname": "User",
          "profile_image_url": "url-to-image",
          "language": "en",
          "created_at": "ISO-date-string"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "User not found"
        }
        ```

### Update Current User Profile

**`PUT /users/profile`**

Updates the profile details of the authenticated user. Can update `name`, `surname`, `profile_image_url`, and `language`. Updates to `name`, `surname`, or `profile_image_url` will also propagate to posts and journeys authored by this user.

*   **Authentication:** Required
*   **Request Body:**
    ```json
    {
      "name": "Updated Name",
      "surname": "Updated Surname",
      "profile_image_url": "new-url-to-image",
      "language": "fr"
    }
    ```
    (Fields can be `null` to clear them, or omitted to keep current value)
*   **Response:**
    *   `200 OK`
        ```json
        {
          "user": {
            "id": "uuid-string",
            "username": "current_user",
            "isAdmin": false,
            "name": "Updated Name",
            "surname": "Updated Surname",
            "profile_image_url": "new-url-to-image",
            "language": "fr",
            "created_at": "ISO-date-string"
          },
          "token": "new-jwt-token-string"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "User not found"
        }
        ```

### Admin: Get All Users

**`GET /users`**

Retrieves a list of all users in the system. (Admin only)

*   **Authentication:** Required (Admin)
*   **Response:**
    *   `200 OK`
        ```json
        [
          {
            "id": "uuid-string-1",
            "username": "admin_user",
            "isAdmin": true,
            "name": "Admin",
            "surname": "User",
            "profile_image_url": null,
            "language": "en",
            "created_at": "ISO-date-string"
          },
          {
            "id": "uuid-string-2",
            "username": "regular_user",
            "isAdmin": false,
            "name": "Regular",
            "surname": "User",
            "profile_image_url": "url-to-image",
            "language": "en",
            "created_at": "ISO-date-string"
          }
        ]
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: Only administrators can view all users."
        }
        ```

### Admin: Create New User

**`POST /users`**

Creates a new user account. (Admin only)

*   **Authentication:** Required (Admin)
*   **Request Body:**
    ```json
    {
      "username": "new_user",
      "password": "new_password",
      "name": "New",
      "surname": "User"
    }
    ```
    (Name and surname are optional)
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "uuid-string",
          "username": "new_user",
          "isAdmin": false,
          "name": "New",
          "surname": "User",
          "profile_image_url": null,
          "language": "en",
          "created_at": "ISO-date-string"
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "Username and password are required"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: Only administrators can create users."
        }
        ```
    *   `409 Conflict`
        ```json
        {
          "message": "Username already exists"
        }
        ```

### Admin: Update User by ID

**`PUT /users/:id`**

Updates an existing user's details by ID. (Admin only)

*   **Authentication:** Required (Admin)
*   **Path Parameters:**
    *   `id`: The ID of the user to update.
*   **Request Body:**
    ```json
    {
      "username": "updated_username",
      "name": "Updated Name",
      "surname": "Updated Surname",
      "profile_image_url": "new-url-for-user",
      "is_admin": true,
      "language": "de"
    }
    ```
    (Fields can be `null` to clear them, or omitted to keep current value)
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "uuid-string",
          "username": "updated_username",
          "isAdmin": true,
          "name": "Updated Name",
          "surname": "Updated Surname",
          "profile_image_url": "new-url-for-user",
          "language": "de",
          "created_at": "ISO-date-string"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: Only administrators can update other users."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "User not found"
        }
        ```
    *   `409 Conflict`
        ```json
        {
          "message": "Username already exists"
        }
        ```

### Admin: Reset User Password

**`PUT /users/:id/reset-password`**

Resets the password for a specific user by ID. (Admin only)

*   **Authentication:** Required (Admin)
*   **Path Parameters:**
    *   `id`: The ID of the user whose password to reset.
*   **Request Body:**
    ```json
    {
      "newPassword": "new_secure_password"
    }
    ```
*   **Response:**
    *   `200 OK`
        ```json
        {
          "message": "Password reset successfully"
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "New password is required"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: Only administrators can reset user passwords."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "User not found"
        }
        ```

### Admin: Delete User by ID

**`DELETE /users/:id`**

Deletes a user account by ID. (Admin only)

*   **Authentication:** Required (Admin)
*   **Path Parameters:**
    *   `id`: The ID of the user to delete.
*   **Response:**
    *   `204 No Content`
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: Only administrators can delete users."
        }
        ```
        or
        ```json
        {
          "message": "Forbidden: An administrator cannot delete their own account."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "User not found"
        }
        ```

### Search Users

**`GET /users/search`**

Searches for users by username, name, or surname. (Accessible to all authenticated users)

*   **Authentication:** Required
*   **Query Parameters:**
    *   `query`: The search string.
*   **Response:**
    *   `200 OK`
        ```json
        [
          {
            "id": "uuid-string-1",
            "username": "found_user",
            "isAdmin": false,
            "name": "Found",
            "surname": "User",
            "profile_image_url": null,
            "language": "en",
            "created_at": "ISO-date-string"
          }
        ]
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "Search query is required"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication required to search users."
        }
        ```

---

## 4. Journey Routes

These routes require a valid JWT token in the `Authorization: Bearer <token>` header.

### Get User's Journeys

**`GET /journeys`**

Retrieves a list of journeys owned by or collaborated with the authenticated user.

*   **Authentication:** Required
*   **Response:**
    *   `200 OK`
        ```json
        [
          {
            "id": "uuid-string-1",
            "name": "My First Journey",
            "created_at": "ISO-date-string",
            "user_id": "owner-uuid",
            "is_public": false,
            "public_link_id": null,
            "owner_username": "owner_user",
            "owner_name": "Owner",
            "owner_surname": "Name",
            "owner_profile_image_url": "url-to-image",
            "has_passphrase": false
          }
        ]
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```

### Admin: Get All Journeys

**`GET /journeys/admin`**

Retrieves a list of all journeys in the system. (Admin only)

*   **Authentication:** Required (Admin)
*   **Response:**
    *   `200 OK`
        ```json
        [
          {
            "id": "uuid-string-1",
            "name": "Admin's Journey",
            "created_at": "ISO-date-string",
            "user_id": "admin-uuid",
            "is_public": true,
            "public_link_id": "public-uuid",
            "owner_username": "admin_user",
            "owner_name": "Admin",
            "owner_surname": "User",
            "owner_profile_image_url": null,
            "has_passphrase": true
          }
        ]
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: Only administrators can view all journeys."
        }
        ```

### Create New Journey

**`POST /journeys`**

Creates a new journey for the authenticated user. New journeys are private by default.

*   **Authentication:** Required
*   **Request Body:**
    ```json
    {
      "name": "New Adventure"
    }
    ```
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "uuid-string",
          "name": "New Adventure",
          "created_at": "ISO-date-string",
          "user_id": "owner-uuid",
          "is_public": false,
          "public_link_id": null,
          "owner_username": "owner_user",
          "owner_name": "Owner",
          "owner_surname": "Name",
          "owner_profile_image_url": "url-to-image",
          "has_passphrase": false
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "Journey name is required"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```

### Update Journey Details

**`PUT /journeys/:id`**

Updates the name of an existing journey. Only the owner or an admin can update a journey.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the journey to update.
*   **Request Body:**
    ```json
    {
      "name": "Updated Journey Name"
    }
    ```
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "uuid-string",
          "name": "Updated Journey Name",
          "created_at": "ISO-date-string",
          "user_id": "owner-uuid",
          "is_public": false,
          "public_link_id": null,
          "owner_username": "owner_user",
          "owner_name": "Owner",
          "owner_surname": "Name",
          "owner_profile_image_url": "url-to-image",
          "has_passphrase": false
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to edit this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```

### Publish Journey

**`POST /journeys/:id/publish`**

Makes a journey public and generates a `public_link_id`. Optionally, a passphrase can be set. Only the owner or an admin can publish a journey.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the journey to publish.
*   **Request Body (Optional):**
    ```json
    {
      "passphrase": "my_secret_passphrase"
    }
    ```
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "uuid-string",
          "name": "My Public Journey",
          "created_at": "ISO-date-string",
          "user_id": "owner-uuid",
          "is_public": true,
          "public_link_id": "new-public-uuid",
          "owner_username": "owner_user",
          "owner_name": "Owner",
          "owner_surname": "Name",
          "owner_profile_image_url": "url-to-image",
          "has_passphrase": true
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to publish this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```

### Unpublish Journey

**`POST /journeys/:id/unpublish`**

Makes a public journey private and clears its `public_link_id` and `passphrase_hash`. Only the owner or an admin can unpublish a journey.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the journey to unpublish.
*   **Request Body:** (Empty, or `{ "dummy": true }` if Fastify requires a body for POST)
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "uuid-string",
          "name": "My Private Journey",
          "created_at": "ISO-date-string",
          "user_id": "owner-uuid",
          "is_public": false,
          "public_link_id": null,
          "owner_username": "owner_user",
          "owner_name": "Owner",
          "owner_surname": "Name",
          "owner_profile_image_url": "url-to-image",
          "has_passphrase": false
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to unpublish this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```

### Set/Update Journey Passphrase

**`POST /journeys/:id/set-passphrase`**

Sets or updates a passphrase for an *already public* journey. Only the owner or an admin can manage the passphrase.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the journey.
*   **Request Body:**
    ```json
    {
      "passphrase": "new_secret_passphrase"
    }
    ```
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "uuid-string",
          "name": "My Public Journey",
          "created_at": "ISO-date-string",
          "user_id": "owner-uuid",
          "is_public": true,
          "public_link_id": "public-uuid",
          "owner_username": "owner_user",
          "owner_name": "Owner",
          "owner_surname": "Name",
          "owner_profile_image_url": "url-to-image",
          "has_passphrase": true
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "Passphrase is required"
        }
        ```
        or
        ```json
        {
          "message": "Cannot set passphrase for a private journey. Publish it first."
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to manage passphrase for this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```

### Clear Journey Passphrase

**`POST /journeys/:id/clear-passphrase`**

Removes the passphrase protection from an *already public* journey. The journey remains public. Only the owner or an admin can clear the passphrase.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the journey.
*   **Request Body:** (Empty, or `{ "dummy": true }` if Fastify requires a body for POST)
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "uuid-string",
          "name": "My Public Journey",
          "created_at": "ISO-date-string",
          "user_id": "owner-uuid",
          "is_public": true,
          "public_link_id": "public-uuid",
          "owner_username": "owner_user",
          "owner_name": "Owner",
          "owner_surname": "Name",
          "owner_profile_image_url": "url-to-image",
          "has_passphrase": false
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "Cannot clear passphrase for a private journey."
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to manage passphrase for this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```

### Delete Journey

**`DELETE /journeys/:id`**

Deletes a journey and all its associated posts and collaborator permissions. Only the owner or an admin can delete a journey.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the journey to delete.
*   **Response:**
    *   `204 No Content`
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to delete this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```

### Get Journey Collaborators

**`GET /journeys/:id/collaborators`**

Retrieves a list of collaborators for a specific journey. Only the owner, an admin, or an existing collaborator can view this list.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the journey.
*   **Response:**
    *   `200 OK`
        ```json
        [
          {
            "id": "permission-uuid-1",
            "journey_id": "journey-uuid",
            "user_id": "collaborator-uuid-1",
            "can_read_posts": true,
            "can_publish_posts": true,
            "can_modify_post": false,
            "can_delete_posts": false,
            "username": "collab_user_1",
            "name": "Collaborator",
            "surname": "One",
            "profile_image_url": null
          }
        ]
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to view collaborators for this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```

### Add Journey Collaborator

**`POST /journeys/:id/collaborators`**

Adds a new collaborator to a journey. Default permissions are `can_read_posts: true`, `can_publish_posts: true`, `can_modify_post: true`, `can_delete_posts: false`. Only the owner or an admin can add collaborators.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the journey.
*   **Request Body:**
    ```json
    {
      "username": "collaborator_username"
    }
    ```
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "permission-uuid",
          "journey_id": "journey-uuid",
          "user_id": "collaborator-uuid",
          "can_read_posts": true,
          "can_publish_posts": true,
          "can_modify_post": true,
          "can_delete_posts": false
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "Cannot add journey owner as collaborator"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to manage collaborators for this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```
        or
        ```json
        {
          "message": "User to add not found"
        }
        ```
    *   `409 Conflict`
        ```json
        {
          "message": "User is already a collaborator"
        }
        ```

### Update Collaborator Permissions

**`PUT /journeys/:journeyId/collaborators/:userId`**

Updates the permissions of an existing collaborator for a specific journey. Only the owner or an admin can update permissions.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `journeyId`: The ID of the journey.
    *   `userId`: The ID of the collaborator user.
*   **Request Body:**
    ```json
    {
      "can_publish_posts": false,
      "can_modify_post": true,
      "can_delete_posts": true
    }
    ```
    (Permissions not included will retain their current value. `can_read_posts` is always `true` for collaborators and cannot be changed via this endpoint.)
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "permission-uuid",
          "journey_id": "journey-uuid",
          "user_id": "collaborator-uuid",
          "can_read_posts": true,
          "can_publish_posts": false,
          "can_modify_post": true,
          "can_delete_posts": true
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to manage collaborators for this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```
        or
        ```json
        {
          "message": "Collaborator not found for this journey"
        }
        ```

### Remove Collaborator

**`DELETE /journeys/:journeyId/collaborators/:userId`**

Removes a collaborator from a journey. Only the owner or an admin can remove collaborators.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `journeyId`: The ID of the journey.
    *   `userId`: The ID of the collaborator user to remove.
*   **Response:**
    *   `204 No Content`
    *   `401 Unauthorized`
        ```json
        {
          "message": "Authentication token required"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to manage collaborators for this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```
        or
        ```json
        {
          "message": "Collaborator not found for this journey"
        }
        ```

---

## 5. Post Routes

These routes require a valid JWT token in the `Authorization: Bearer <token>` header.

### Get Posts for a Journey

**`GET /posts`**

Retrieves posts for a specific journey. Can filter by `is_draft`. Access is restricted to journey owners, admins, or collaborators with `can_read_posts` permission.

*   **Authentication:** Required
*   **Query Parameters:**
    *   `journeyId` (required): The ID of the journey.
    *   `is_draft` (optional): `true` to fetch drafts, `false` (default) to fetch published posts.
*   **Response:**
    *   `200 OK`
        ```json
        [
          {
            "id": "post-uuid-1",
            "journey_id": "journey-uuid",
            "user_id": "author-uuid",
            "author_username": "author_user",
            "author_name": "Author",
            "author_surname": "Name",
            "author_profile_image_url": "url-to-image",
            "title": "My First Post",
            "message": "This is the content of my first post.",
            "media_items": [
              {
                "type": "image",
                "urls": {
                  "small": "/uploads/image-small.jpg",
                  "medium": "/uploads/image-medium.jpg",
                  "large": "/uploads/image-large.jpg",
                  "original": "/uploads/image-original.jpg"
                }
              }
            ],
            "coordinates": {
              "lat": 40.7128,
              "lng": -74.0060
            },
            "created_at": "ISO-date-string",
            "is_draft": false
          }
        ]
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "journeyId is required"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Unauthorized"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to read posts in this journey."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```

### Create New Post

**`POST /posts`**

Creates a new post within a specified journey. Can be created as a draft (`is_draft: true`) or published (`is_draft: false`). Permissions vary based on `is_draft` status.

*   **Authentication:** Required
*   **Request Body:**
    ```json
    {
      "journeyId": "journey-uuid",
      "title": "New Post Title (Optional)",
      "message": "This is the message content.",
      "media_items": [
        {
          "type": "image",
          "urls": {
            "small": "/uploads/image-small.jpg",
            "medium": "/uploads/image-medium.jpg",
            "large": "/uploads/image-large.jpg",
            "original": "/uploads/image-original.jpg"
          }
        }
      ],
      "coordinates": {
        "lat": 40.7128,
        "lng": -74.0060
      },
      "created_at": "ISO-date-string (Optional, defaults to now)",
      "is_draft": false
    }
    ```
    (At least `title`, `message`, `media_items`, or `coordinates` must be provided. `is_draft` defaults to `false` if omitted.)
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "new-post-uuid",
          "journey_id": "journey-uuid",
          "user_id": "author-uuid",
          "author_username": "author_user",
          "author_name": "Author",
          "author_surname": "Name",
          "author_profile_image_url": "url-to-image",
          "title": "New Post Title",
          "message": "This is the message content.",
          "media_items": [...],
          "coordinates": {...},
          "created_at": "ISO-date-string",
          "is_draft": false
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "journeyId is required"
        }
        ```
        or
        ```json
        {
          "message": "At least a title, message, media, or coordinates are required"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Unauthorized"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to create published posts in this journey."
        }
        ```
        (or similar for drafts if permissions are insufficient)
    *   `404 Not Found`
        ```json
        {
          "message": "Journey not found"
        }
        ```

### Update Post

**`PUT /posts/:id`**

Updates an existing post. Permissions are required to modify the post, and additional permissions are needed to change a draft to a published post.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the post to update.
*   **Request Body:**
    ```json
    {
      "title": "Updated Post Title",
      "message": "Updated message content.",
      "media_items": [
        {
          "type": "image",
          "urls": {
            "medium": "/uploads/updated-image.jpg"
          }
        }
      ],
      "coordinates": {
        "lat": 41.0,
        "lng": -73.0
      },
      "created_at": "ISO-date-string (Optional, to change post date)",
      "is_draft": false
    }
    ```
    (Fields can be `null` to clear them, or omitted to keep current value. `is_draft` can be updated.)
*   **Response:**
    *   `200 OK`
        ```json
        {
          "id": "post-uuid",
          "journey_id": "journey-uuid",
          "user_id": "author-uuid",
          "author_username": "author_user",
          "author_name": "Author",
          "author_surname": "Name",
          "author_profile_image_url": "url-to-image",
          "title": "Updated Post Title",
          "message": "Updated message content.",
          "media_items": [...],
          "coordinates": {...},
          "created_at": "ISO-date-string",
          "is_draft": false
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Unauthorized"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to edit this post."
        }
        ```
        (or similar if trying to publish a draft without `can_publish_posts` permission)
    *   `404 Not Found`
        ```json
        {
          "message": "Post not found"
        }
        ```
        or
        ```json
        {
          "message": "Associated journey not found"
        }
        ```

### Delete Post

**`DELETE /posts/:id`**

Deletes a post by its ID. Permissions are required to delete the post.

*   **Authentication:** Required
*   **Path Parameters:**
    *   `id`: The ID of the post to delete.
*   **Response:**
    *   `204 No Content`
    *   `401 Unauthorized`
        ```json
        {
          "message": "Unauthorized"
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Forbidden: You do not have permission to delete this post."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Post not found"
        }
        ```
        or
        ```json
        {
          "message": "Associated journey not found"
        }
        ```

---

## 6. Media Routes

These routes require a valid JWT token in the `Authorization: Bearer <token>` header.

### Upload Media

**`POST /media/upload-media`**

Uploads a base64 encoded media file (image or video) to the server. Can be used for general post media or profile images.

*   **Authentication:** Required
*   **Request Body:**
    ```json
    {
      "fileBase64": "base64-encoded-file-string",
      "fileType": "image/jpeg",
      "isProfileImage": false
    }
    ```
    *   `fileBase64`: The base64 string of the file content.
    *   `fileType`: The MIME type of the file (e.g., `image/jpeg`, `video/mp4`).
    *   `isProfileImage`: Boolean indicating if this is a profile image upload. If `true` and `fileType` is an image, the authenticated user's `profile_image_url` will be updated.
*   **Response:**
    *   `200 OK`
        ```json
        {
          "mediaInfo": {
            "type": "image",
            "urls": {
              "small": "/uploads/uuid-original.jpeg",
              "medium": "/uploads/uuid-original.jpeg",
              "large": "/uploads/uuid-original.jpeg",
              "original": "/uploads/uuid-original.jpeg"
            }
          }
        }
        ```
        or for video:
        ```json
        {
          "mediaInfo": {
            "type": "video",
            "url": "/uploads/uuid-original.mp4"
          }
        }
        ```
    *   `400 Bad Request`
        ```json
        {
          "message": "File data and type are required"
        }
        ```
        or
        ```json
        {
          "message": "Unsupported media type"
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Unauthorized"
        }
        ```
    *   `500 Internal Server Error`
        ```json
        {
          "message": "Failed to save uploaded file"
        }
        ```

---

## 7. Public Journey Access

These routes are public and do not require a JWT token.

### Access Public Journey by Link ID

**`POST /public-journeys/:publicLinkId`**

Retrieves a public journey and its published posts using its unique public link ID. If the journey is passphrase-protected, the passphrase must be provided in the request body.

*   **Authentication:** None
*   **Path Parameters:**
    *   `publicLinkId`: The unique ID generated when the journey was made public.
*   **Request Body (Optional):**
    ```json
    {
      "passphrase": "journey_passphrase"
    }
    ```
    (Required if the journey is passphrase-protected)
*   **Response:**
    *   `200 OK`
        ```json
        {
          "journey": {
            "id": "journey-uuid",
            "name": "My Public Journey",
            "created_at": "ISO-date-string",
            "user_id": "owner-uuid",
            "is_public": true,
            "public_link_id": "public-uuid",
            "owner_username": "owner_user",
            "owner_name": "Owner",
            "owner_surname": "Name",
            "owner_profile_image_url": "url-to-image",
            "has_passphrase": true
          },
          "posts": [
            {
              "id": "post-uuid-1",
              "journey_id": "journey-uuid",
              "user_id": "author-uuid",
              "author_username": "author_user",
              "author_name": "Author",
              "author_surname": "Name",
              "author_profile_image_url": "url-to-image",
              "title": "Public Post Title",
              "message": "Content of a public post.",
              "media_items": [...],
              "coordinates": {...},
              "created_at": "ISO-date-string",
              "is_draft": false
            }
          ]
        }
        ```
    *   `401 Unauthorized`
        ```json
        {
          "message": "Passphrase required to access this journey."
        }
        ```
    *   `403 Forbidden`
        ```json
        {
          "message": "Incorrect passphrase."
        }
        ```
    *   `404 Not Found`
        ```json
        {
          "message": "Public journey not found or not published."
        }
        ```