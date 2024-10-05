
CREATE TABLE users (
    id INT AUTO_INCREMENT NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    profile_image VARCHAR(255),
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE TRIGGER users_created BEFORE INSERT ON users FOR EACH ROW SET new.created = UNIX_TIMESTAMP(NOW()); 
