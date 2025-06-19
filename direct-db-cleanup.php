<?php
// Direct WordPress database cleanup script
// This should be placed in the WordPress root directory and accessed directly

// Load WordPress
require_once('wp-config.php');
require_once('wp-includes/wp-db.php');

// Initialize WordPress database connection
global $wpdb;

// Find the hire-now page ID
$page_id = $wpdb->get_var("SELECT ID FROM {$wpdb->posts} WHERE post_name = 'hire-now' AND post_type = 'page'");

if ($page_id) {
    echo "Found hire-now page with ID: $page_id\n";
    
    // Remove the Yoast meta description
    $deleted = $wpdb->delete(
        $wpdb->postmeta,
        array(
            'post_id' => $page_id,
            'meta_key' => '_yoast_wpseo_metadesc'
        )
    );
    
    if ($deleted) {
        echo "Successfully removed meta description from hire-now page\n";
    } else {
        echo "No meta description found to remove\n";
    }
    
    // Also remove any other SEO meta that might have been added
    $other_meta_keys = array(
        '_yoast_wpseo_title',
        '_yoast_wpseo_focuskw',
        '_yoast_wpseo_meta-robots-noindex',
        '_yoast_wpseo_opengraph-description'
    );
    
    foreach ($other_meta_keys as $meta_key) {
        $deleted = $wpdb->delete(
            $wpdb->postmeta,
            array(
                'post_id' => $page_id,
                'meta_key' => $meta_key
            )
        );
        if ($deleted) {
            echo "Removed $meta_key\n";
        }
    }
    
    // Clear WordPress object cache
    wp_cache_delete($page_id, 'posts');
    wp_cache_delete($page_id, 'post_meta');
    
    echo "Cache cleared for page ID: $page_id\n";
    echo "Revert completed successfully!\n";
    
} else {
    echo "Error: hire-now page not found\n";
}
?>