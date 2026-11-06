
import os

files = ['main.py', 'database.py', 'routers/auth.py']
for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    # Remove messed up syntax
    content = content.replace('try:
    from dotenv import load_dotenv
    
except ImportError:
    pass', '')
    content = content.replace('try:\n    from dotenv import load_dotenv\n    \nexcept ImportError:\n    pass', '')
    
    # Clean up and re-add gracefully
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if 'dotenv' in line or 'load_dotenv' in line or line.startswith('try:
'):
            continue
        new_lines.append(line)
        
    final_content = 'import os\n'
    final_content += 'try:\n'
    final_content += '    from dotenv import load_dotenv\n'
    final_content += '    load_dotenv()\n'
    final_content += 'except ImportError:\n'
    final_content += '    pass\n\n'
    
    # Remove duplicate import os if it's there
    for line in new_lines:
        if line.strip() == 'import os':
            continue
        final_content += line + '\n'
        
    with open(f, 'w') as file:
        file.write(final_content)

