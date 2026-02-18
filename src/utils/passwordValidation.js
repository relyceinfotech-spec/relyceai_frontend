/**
 * Password Validation Utility
 * Enforces strong password requirements for signup
 */

const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

/**
 * Validate password against all requirements
 * @param {string} password 
 * @returns {{ isValid: boolean, errors: string[], checks: object }}
 */
export function validatePassword(password) {
    const checks = {
        minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[^A-Za-z0-9]/.test(password)
    };

    const errors = [];

    if (!checks.minLength) {
        errors.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
    }
    if (PASSWORD_REQUIREMENTS.requireUppercase && !checks.hasUppercase) {
        errors.push('One uppercase letter');
    }
    if (PASSWORD_REQUIREMENTS.requireLowercase && !checks.hasLowercase) {
        errors.push('One lowercase letter');
    }
    if (PASSWORD_REQUIREMENTS.requireNumber && !checks.hasNumber) {
        errors.push('One number');
    }
    if (PASSWORD_REQUIREMENTS.requireSpecial && !checks.hasSpecial) {
        errors.push('One special character (!@#$%^&*...)');
    }

    return {
        isValid: errors.length === 0,
        errors,
        checks
    };
}

/**
 * Get password strength score
 * @param {string} password 
 * @returns {'weak' | 'medium' | 'strong'}
 */
export function getPasswordStrength(password) {
    if (!password) return 'weak';

    let score = 0;

    // Length scoring
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Complexity scoring
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // Variety bonus (mix of character types)
    const types = [
        /[a-z]/.test(password),
        /[A-Z]/.test(password),
        /[0-9]/.test(password),
        /[^A-Za-z0-9]/.test(password)
    ].filter(Boolean).length;

    if (types >= 4) score += 2;
    else if (types >= 3) score += 1;

    // Return strength level
    if (score >= 8) return 'strong';
    if (score >= 5) return 'medium';
    return 'weak';
}

export default { validatePassword, getPasswordStrength };
