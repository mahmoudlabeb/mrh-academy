@echo off
echo ===STUDENT PROFILE (follow redirect)===
curl.exe -s -L -i http://localhost:3000/student/profile -o test5_student_full.txt
findstr /B "HTTP" test5_student_full.txt
echo.
echo ===TUTOR PROFILE (follow redirect)===
curl.exe -s -L -i http://localhost:3000/tutor/profile -o test5_tutor_full.txt
findstr /B "HTTP" test5_tutor_full.txt
