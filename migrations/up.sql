CREATE TABLE users (
    id INT AUTO_INCREMENT NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    profile_image VARCHAR(255),
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE TABLE rooms (
    id INT AUTO_INCREMENT NOT NULL,
    name VARCHAR(255),
    cover_image VARCHAR(255),
    type ENUM('direct', 'group') NOT NULL,
    created BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE TABLE messages (
    id INT AUTO_INCREMENT NOT NULL,
    room_id INT NOT NULL,
    sender_id INT,
    text VARCHAR(10000) NOT NULL,
    created BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE TABLE files (
    id INT AUTO_INCREMENT NOT NULL,
    message_id INT NOT NULL,
    message_index INT NOT NULL,
    file_hash VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    created BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY (message_id) REFERENCES messages(id),
    UNIQUE (message_id, message_index)
);

CREATE TABLE user_rooms (
    user_id INT NOT NULL,
    room_id INT NOT NULL,
    created BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, room_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TRIGGER users_created BEFORE INSERT ON users FOR EACH ROW SET new.created = UNIX_TIMESTAMP(NOW()); 
CREATE TRIGGER rooms_created BEFORE INSERT ON rooms FOR EACH ROW SET new.created = UNIX_TIMESTAMP(NOW()); 
CREATE TRIGGER messages_created BEFORE INSERT ON messages FOR EACH ROW SET new.created = UNIX_TIMESTAMP(NOW()); 
CREATE TRIGGER files_created BEFORE INSERT ON files FOR EACH ROW SET new.created = UNIX_TIMESTAMP(NOW()); 
CREATE TRIGGER user_rooms_created BEFORE INSERT ON user_rooms FOR EACH ROW SET new.created = UNIX_TIMESTAMP(NOW()); 
