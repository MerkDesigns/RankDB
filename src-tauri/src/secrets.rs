//! AES-256-GCM field primitive. `credential_security.rs` owns the optional password-wrapped key.
//!
//! A sealed field is `nonce (12 bytes) || ciphertext+tag`. The associated data binds it to its
//! account and field, so a value moved to another row or column fails to open.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};

const NONCE_LENGTH: usize = 12;

pub struct Secrets {
    cipher: Aes256Gcm,
}

impl Secrets {
    pub(crate) fn from_key(key: &[u8]) -> Result<Self, String> {
        let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| crate::text::text("errors.secrets.credentialKeyDamaged").to_string())?;
        Ok(Self { cipher })
    }

    pub fn seal(&self, plaintext: &str, binding: &str) -> Result<Vec<u8>, String> {
        let nonce_bytes = random_bytes(NONCE_LENGTH)?;
        let nonce = Nonce::try_from(nonce_bytes.as_slice()).map_err(|_| crate::text::text("errors.secrets.invalidNonce").to_string())?;
        let ciphertext = self
            .cipher
            .encrypt(&nonce, Payload { msg: plaintext.as_bytes(), aad: binding.as_bytes() })
            .map_err(|_| crate::text::text("errors.secrets.encryptionFailed").to_string())?;
        Ok([nonce_bytes, ciphertext].concat())
    }

    pub fn open_sealed(&self, sealed: &[u8], binding: &str) -> Result<String, String> {
        if sealed.len() < NONCE_LENGTH {
            return Err(crate::text::text("errors.secrets.secretDamaged").into());
        }
        let (nonce_bytes, ciphertext) = sealed.split_at(NONCE_LENGTH);
        let nonce = Nonce::try_from(nonce_bytes).map_err(|_| crate::text::text("errors.secrets.invalidNonce").to_string())?;
        let plaintext = self
            .cipher
            .decrypt(&nonce, Payload { msg: ciphertext, aad: binding.as_bytes() })
            .map_err(|_| crate::text::text("errors.secrets.decryptionFailed").to_string())?;
        String::from_utf8(plaintext).map_err(|_| crate::text::text("errors.secrets.secretDamaged").into())
    }
}

fn random_bytes(length: usize) -> Result<Vec<u8>, String> {
    let mut bytes = vec![0u8; length];
    getrandom::fill(&mut bytes).map_err(|error| error.to_string())?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::Secrets;

    #[test]
    fn seals_opens_and_binds_to_its_field() {
        let secrets = Secrets::from_key(&[7u8; 32]).unwrap();
        let sealed = secrets.seal("hunter2", "rankdb:1:password").unwrap();
        assert_eq!(secrets.open_sealed(&sealed, "rankdb:1:password").unwrap(), "hunter2");
        // Moved to another account or field, it no longer opens.
        assert!(secrets.open_sealed(&sealed, "rankdb:2:password").is_err());
        assert!(secrets.open_sealed(&sealed, "rankdb:1:email").is_err());
        // The same nonce is never reused.
        assert_ne!(sealed, secrets.seal("hunter2", "rankdb:1:password").unwrap());
        // Another key can't open it.
        assert!(Secrets::from_key(&[8u8; 32]).unwrap().open_sealed(&sealed, "rankdb:1:password").is_err());
    }
}
