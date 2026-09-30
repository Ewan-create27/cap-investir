ALTER TABLE accounts ADD COLUMN email text;
ALTER TABLE accounts ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX accounts_verified_email ON accounts(email) WHERE email_verified;
CREATE TABLE email_challenges(
 id text PRIMARY KEY,
 account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK(purpose IN ('verify','reset')),
 email text NOT NULL,
 code_hash text NOT NULL,
 password_fingerprint text NOT NULL,
 created bigint NOT NULL,
 expires bigint NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 used boolean NOT NULL DEFAULT false
);
CREATE INDEX email_challenges_rate ON email_challenges(account_id,purpose,created);
