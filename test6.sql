SELECT * FROM tutor_profiles WHERE "userId" = (SELECT id FROM users WHERE email='tutor.verify@test.com');
