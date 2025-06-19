<?php
/*
Plugin Name: Clear Hire Now Cache
Description: Reverts SEO changes and clears cache for hire-now page
Version: 1.0
*/

// Direct database cleanup for hire-now page
function clear_hire_now_seo_data() {
    global $wpdb;
    
    // Get the hire-now page ID
    $page = get_page_by_path('hire-now');
    if (!$page) {
        return false;
    }
    
    $post_id = $page->ID;
    
    // Remove all Yoast SEO meta data
    delete_post_meta($post_id, '_yoast_wpseo_metadesc');
    delete_post_meta($post_id, '_yoast_wpseo_title');
    delete_post_meta($post_id, '_yoast_wpseo_focuskw');
    delete_post_meta($post_id, '_yoast_wpseo_meta-robots-noindex');
    delete_post_meta($post_id, '_yoast_wpseo_meta-robots-nofollow');
    delete_post_meta($post_id, '_yoast_wpseo_opengraph-title');
    delete_post_meta($post_id, '_yoast_wpseo_opengraph-description');
    delete_post_meta($post_id, '_yoast_wpseo_twitter-title');
    delete_post_meta($post_id, '_yoast_wpseo_twitter-description');
    
    // Clear any custom meta fields that might have been added
    delete_post_meta($post_id, '_needs_h1_fix');
    delete_post_meta($post_id, '_main_heading');
    delete_post_meta($post_id, '_seo_fixes_applied');
    
    // Clear WordPress cache if available
    if (function_exists('wp_cache_flush')) {
        wp_cache_flush();
    }
    
    // Clear object cache
    wp_cache_delete($post_id, 'posts');
    wp_cache_delete($post_id, 'post_meta');
    
    return true;
}

// REST API endpoint to trigger cleanup
add_action('rest_api_init', function () {
    register_rest_route('synviz/v1', '/clear-hire-now-cache', [
        'methods' => 'POST',
        'callback' => function() {
            $result = clear_hire_now_seo_data();
            return [
                'success' => $result,
                'message' => $result ? 'Cache cleared and SEO data reverted' : 'Failed to clear cache',
                'timestamp' => current_time('mysql')
            ];
        },
        'permission_callback' => '__return_true'
    ]);
});

// Auto-run on plugin activation
register_activation_hook(__FILE__, 'clear_hire_now_seo_data');
?>