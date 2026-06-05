FROM nginx:alpine

COPY index.html /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY templates/ /usr/share/nginx/html/templates/
COPY values/ /usr/share/nginx/html/values/
COPY data-coding.json /usr/share/nginx/html/
COPY data-theory.json /usr/share/nginx/html/

EXPOSE 80
