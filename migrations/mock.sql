# the passes are 1234

INSERT INTO users (username, password) VALUES
('aaaa', '$2b$10$2P/Fhoj9DI/xjHd8RyKIS.DSUoD4P60doFS7S/gCfjKx6hji/0g3y'),
('bbbb', '$2b$10$2P/Fhoj9DI/xjHd8RyKIS.DSUoD4P60doFS7S/gCfjKx6hji/0g3y'),
('cccc', '$2b$10$2P/Fhoj9DI/xjHd8RyKIS.DSUoD4P60doFS7S/gCfjKx6hji/0g3y'),
('dddd', '$2b$10$2P/Fhoj9DI/xjHd8RyKIS.DSUoD4P60doFS7S/gCfjKx6hji/0g3y'),
('eeee', '$2b$10$2P/Fhoj9DI/xjHd8RyKIS.DSUoD4P60doFS7S/gCfjKx6hji/0g3y');

UPDATE users SET role = 'admin' WHERE username = 'bbbb';
