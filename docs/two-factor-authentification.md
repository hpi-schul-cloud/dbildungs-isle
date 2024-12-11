This document explains the processes involved for the two-factor authentification with privacyIdea.

## 2FA set up with Hardwaretoken

In the administration area of the application, admins can assign a hardware token for two-factor authentication to each user individually. The serial number and the one-time password (OTP) displayed on the token are entered. The admin is notified via a pop-up whether the assignment was successful and the two-factor authentication has been configured.

**Process: Function: `assignHardwareToken(serial, otp, user)`**

The `assignHardwareToken` function is responsible for assigning a hardware token to a user, ensuring all necessary validations are performed.

1. **Retrieve JWT Token**
   Call `getJWTToken()` to obtain a valid token for authentication with the API.

2. **Validate User**

    - Check if the user exists in privacyIdea using `checkUserExists(user)`.
    - If the user does not exist, create the user by calling `addUser(user)`.
    - If the user already exists, check for any previously assigned token:
        - Retrieve the old token with `getTokenToVerify(user)`.
        - If an old token exists, delete it using `deleteToken(oldTokenToVerify.serial)`.

3. **Verify Token Status**

    - Call `verifyTokenStatus(serial, token)` to check the status of the hardware token in privacyIdea.
    - Ensure the token exists in the system:
        - If `tokenVerificationResponse.result.value.count == 0`, throw `SerialNotFoundError`.
    - Check if the token is already assigned to another user:
        - If `tokenVerificationResponse.result.value.tokens[0].username` is not empty, throw `SerialInUseError`.

4. **Verify OTP**

    - Call `getSerialWithOTP(serial, otp, token)` to validate the provided OTP in privacyIdea.
    - Ensure the OTP matches the serial number:
        - If `tokenOTPserialResponse.result.value.serial != serial`, throw `OTPnotValidError`.

5. **Assign Token**
    - Call `assignToken(serial, token, user)` to complete the assignment of the token to the specified user.
    - Return the result of the assignment process.

## 2FA set up with Softwaretoken

## 2FA token reset
