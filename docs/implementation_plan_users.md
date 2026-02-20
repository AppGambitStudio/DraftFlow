
# Implementation Plan: Users & Team Collaboration (Tenant-Based)

## Overview
We will implement a robust **Multi-Tenant Architecture**.
*   **Tenant**: Represents a shared workspace (Organization).
*   **User**: A global identity that can belong to multiple Tenants.
*   **Member**: The link between User and Tenant, defining the Role.
*   **Data Scope**: All content (`Post`, `Idea`) belongs to a **Tenant**, not a User. `userId` on these records tracks "Created By".

## 1. Database Schema Changes

### New `Tenant` Model
*   `id` (String, UUID): Primary Key.
*   `name` (String): Workspace name (default to "My Workspace").
*   `createdAt`: Date.

### New `TenantMember` Model
*   `id` (Integer, PK)
*   `userId` (String, FK -> User.id)
*   `tenantId` (String, FK -> Tenant.id)
*   `role` (String): 'OWNER', 'ADMIN', 'EDITOR'.

### New `Invitation` Model
*   `id` (Integer, PK)
*   `email` (String)
*   `tenantId` (String, FK -> Tenant.id)
*   `token` (String, Unique)
*   `role` (String)
*   `expiresAt` (Date)
*   `status` (String: 'PENDING', 'ACCEPTED')

### Update Core Models (`Post`, `Idea`, `Settings`)
*   Add `tenantId` (String, FK -> Tenant.id) to all three models.
*   **Migration Constraint**: `userId` is currently used for ownership. We will keep `userId` as "Created By" but rely on `tenantId` for filtering.

## 2. Backend Refactoring

### Middleware Update (`authMiddleware.ts`)
*   Modify `AuthRequest` interface:
    ```typescript
    export interface AuthRequest extends Request {
        user?: User;         // The logged-in user
        tenantId?: string;   // The active workspace ID
        membership?: TenantMember; // Role info
    }
    ```
*   **Resolution Logic**:
    1.  Get User from Token.
    2.  Check for `x-tenant-id` header (for context switching).
    3.  If no header, fetch the first `TenantMember` record for this user (Default Workspace).
    4.  Set `req.tenantId` = `member.tenantId`.

### Route Updates (The "Great Find & Replace")
*   **Crucial**: All DB queries must change from `where: { userId }` to `where: { tenantId }`.
    *   *Before*: `Post.findAll({ where: { userId } })`
    *   *After*: `Post.findAll({ where: { tenantId } })`
*   **creation**: `Post.create({ ..., tenantId: req.tenantId, userId: req.user.id })`

### API Routes
*   `GET /api/invitations`: List pending invites for current tenant.
*   `POST /api/invitations`: Invite email to current tenant.
*   `POST /api/invitations/accept`: Public route to accept token.
*   `GET /api/users/me`: Return user info + list of Tenants.

## 3. Migration Strategy (Critical)
Since we are moving from User-Centric to Tenant-Centric, we need a 3-step migration script:
1.  **Schema Update**: Create `Tenant`, `TenantMember` tables. Add `tenantId` columns.
2.  **Backfill**:
    *   For every `User`:
        *   Create a `Tenant` (Name: "[User]'s Workspace").
        *   Create `TenantMember` (User -> Tenant, Role: OWNER).
        *   **Update Data**: Set `tenantId` on all `Posts`, `Ideas`, `Settings` where `userId` matches.
3.  **Validation**: Ensure no records have null `tenantId`.

## 4. Frontend Implementation

### Context
*   Update `api.ts` to (optionally) grab the active Tenant ID from LocalStorage and send it in `x-tenant-id` header? 
    *   *MVP*: Just rely on the backend default (first tenant) implies no UI for switching yet.

### UI Changes
*   **Users Page**: List members of the current Tenant.
*   **Invite Flow**: Simple modal to generate link.
