with open('admin-dashboard.html', 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        if 'id=' in line.lower() or 'class=' in line.lower():
            if 'view' in line.lower() or 'tab' in line.lower() or 'section' in line.lower():
                print(f'{idx+1}: {line.strip()}')
