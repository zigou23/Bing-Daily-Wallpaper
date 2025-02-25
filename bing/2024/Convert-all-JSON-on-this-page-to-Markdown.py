import os
import json

# Directory containing the JSON files
json_dir = './'  # Update with your directory path
output_dir = './'  # Directory to save the MD files

# Ensure the output directory exists
os.makedirs(output_dir, exist_ok=True)

# Iterate through each JSON file in the directory
for filename in os.listdir(json_dir):
    if filename.endswith('.json'):
        json_path = os.path.join(json_dir, filename)
        with open(json_path, 'r') as json_file:
            data = json.load(json_file)

        # Initialize the Markdown content
        md_content = "## Bing Wallpaper (2024)\n"
        md_content += "|      |      |      |\n"
        md_content += "| :----: | :----: | :----: |\n"

        # Process the JSON data and create the Markdown table rows
        row = ""
        count = 0

        for item in data:
            date = item['date']
            urlbase = item['urlbase']
            copyright_text = item['copyright']

            # Construct the Markdown link with the modified URL
            md_link = f"![]({urlbase}_UHD.jpg&w=384)[{date[:4]}-{date[4:6]}-{date[6:]}]({urlbase}_UHD.jpg): {copyright_text}"

            # Add the link to the current row
            row += f"|{md_link}"

            count += 1
            if count % 3 == 0:
                # If there are 3 items in the row, add it to the content and reset the row
                md_content += f"{row}|\n"
                row = ""

        # Add any remaining items to the content
        if row:
            md_content += f"{row}{'|' * (3 - count % 3)}\n"

        # Add the final line with empty cells if necessary
        if count % 3 != 0:
            md_content += '||||\n'

        # Define the output Markdown filename
        md_filename = os.path.splitext(filename)[0] + '.md'
        md_path = os.path.join(output_dir, md_filename)

        # Write the Markdown content to a file
        with open(md_path, 'w') as md_file:
            md_file.write(md_content)

        print(f"Converted {filename} to {md_filename}")
