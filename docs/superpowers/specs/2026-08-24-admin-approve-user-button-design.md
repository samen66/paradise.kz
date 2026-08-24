# B2B Client Approval in Admin Panel Design

## Context
When a new B2B client registers, their account is set as pending (unapproved). In the admin panel, administrators could approve the client directly from the users table, but the action was missing from the Edit User page. 

## Goals
1. Provide administrators the ability to approve a B2B user directly from the Edit User page.
2. Ensure that approving a user always goes through the `ApproveClient` action (which handles МойСклад API syncing).
3. Prevent administrators from manually modifying the `is_approved` status without triggering the МойСклад synchronization.

## Implementation Design

### 1. Edit User Page (`app/Filament/Resources/Users/Pages/EditUser.php`)
- **Action**: Add an `Action::make('approve')` to the `getHeaderActions()` method.
- **Properties**: 
  - Visible only if the user is not approved (`! $record->is_approved`) and is a B2B customer.
  - Require confirmation.
  - Display a success notification or a danger notification if an error occurs.
  - Utilize `ApproveClient::class` exactly as it's implemented in `UsersTable.php`.

### 2. User Form (`app/Filament/Resources/Users/Schemas/UserForm.php`)
- **Action**: Modify the `is_approved` toggle to be read-only (`->disabled()`).
- **Reasoning**: This forces administrators to use the explicit "Approve" button rather than just changing a toggle, protecting against database-only approvals that skip the МойСклад counterparty creation.

## Testing & Verification
- Manually edit an unapproved user, verify the "Одобрить" button exists in the header.
- Click the button, ensure the `ApproveClient` service is called.
- Check that the `is_approved` toggle on the form is disabled.
