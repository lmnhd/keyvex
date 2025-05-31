# filename: number_output.py
with open('numbers.txt', 'w') as file:
    for i in range(50, 151):
        file.write(str(i) + '\n')