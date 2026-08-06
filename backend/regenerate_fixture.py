import subprocess, sys, os

# Run manage.py dumpdata and write raw stdout bytes to hospitals_fixture.json
p = subprocess.run([sys.executable, 'manage.py', 'dumpdata', 'hospitals', '--indent', '2'], stdout=subprocess.PIPE, check=True)
with open('hospitals_fixture.json', 'wb') as f:
    f.write(p.stdout)
# Print first 4 bytes as hex for verification
print(open('hospitals_fixture.json','rb').read(4).hex())
