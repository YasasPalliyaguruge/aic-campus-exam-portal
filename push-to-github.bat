@echo off
echo Initializing Git repository...
git init

echo Adding all files...
git add .

echo Committing files...
git commit -m "Initial commit - AIC Campus Exam Portal"

echo Setting branch to main...
git branch -M main

echo Adding remote origin...
git remote add origin https://github.com/YasasPalliyaguruge/aic-campus-exam-portal.git

echo Pushing to GitHub...
git push -u origin main

echo Done!
pause
