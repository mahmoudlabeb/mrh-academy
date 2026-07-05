SELECT * FROM student_profiles WHERE "userId" = (SELECT id FROM users WHERE email='student.verify@test.com');
