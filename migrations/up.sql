
CREATE TABLE users (
    id INT AUTO_INCREMENT NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    profile_image VARCHAR(255),
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created DATETIME NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);
