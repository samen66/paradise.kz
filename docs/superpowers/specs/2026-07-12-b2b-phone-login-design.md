# B2B Phone Login Design

**Goal:** Change the login method for wholesale (B2B) clients from Email to Phone Number, while keeping the password intact. Make email optional in the database and admin panel.

## Architecture & Components

### 1. Database & Admin (Backend)
- **Migration:** Create a new migration to alter the `users` table. The `email` column will be made `nullable()`. Ensure `phone` has a unique constraint if it doesn't already, so duplicate phone numbers are prevented.
- **Filament UserResource:** In `app/Filament/Resources/Users/Schemas/UserForm.php`, remove the `->required()` constraint from the `email` field.

### 2. API (Backend)
- **LoginRequest:** Modify `app/Http/Requests/Auth/LoginRequest.php` to remove the `email` rule and add `phone` as a required string field.
- **AuthController:** In `app/Http/Controllers/Api/Auth/AuthController.php`, update the `login` method to search for the user by `phone` instead of `email` (`User::where('phone', $credentials['phone'])->first()`). Update the validation exception message to "Неверный номер телефона или пароль."
- **RegisterRequest:** Update `app/Http/Requests/Auth/RegisterRequest.php` to make `email` nullable.

### 3. Frontend (Next.js B2B Portal)
- **Login Page (`/b2b/login`):** Modify `storefront/src/app/b2b/login/page.tsx`. Change the `email` state variable to `phone`. Update the HTML input to `type="tel"` with an appropriate label and placeholder. Update the API payload to send `phone` instead of `email`.

## Error Handling
- If a user inputs an incorrect phone number or password, the backend returns a 401/422 status with the message "Неверный номер телефона или пароль", which is safely caught and displayed by the frontend form.

## Testing
- Verify that a user can be created via Filament without an email address.
- Verify that logging in via `/b2b/login` works correctly using the phone number.
- Verify that attempting to login with incorrect credentials shows the correct error message.
