# Dockerfile
FROM php:8.2-apache

# Install PHP extensions and MySQL client
RUN apt-get update && apt-get install -y \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    git \
    curl \
    default-mysql-client \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Enable Apache rewrite module
RUN a2enmod rewrite

# Suppress Apache ServerName warning
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Set working directory
WORKDIR /var/www/html

# Copy project files
COPY . .

# Set Laravel's public folder as Apache DocumentRoot
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/000-default.conf

# Copy PHP production configuration
COPY ./php.ini /usr/local/etc/php/conf.d/

# Install Composer
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

# Install Laravel dependencies optimized for production
RUN composer install --no-dev --prefer-dist --optimize-autoloader --no-scripts

# Set correct permissions
RUN chown -R www-data:www-data storage bootstrap/cache

# Expose HTTP port
EXPOSE 80

# Automatically run migrations and start Apache (local-only approach)
CMD php artisan migrate --force && apache2-foreground
