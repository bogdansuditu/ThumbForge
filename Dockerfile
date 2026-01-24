# Use nginx alpine for a lightweight image
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy application files to nginx html directory
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY js /usr/share/nginx/html/js/
COPY README.md /usr/share/nginx/html/
COPY ThumbForge.svg /usr/share/nginx/html/
COPY ThumbforgeTitle.svg /usr/share/nginx/html/
COPY apple-touch-icon.png /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY fonts /usr/share/nginx/html/fonts/
COPY icons /usr/share/nginx/html/icons/

# Copy custom nginx configuration (optional)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
