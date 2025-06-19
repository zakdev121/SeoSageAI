<?php
/*
Plugin Name: Revert Hire Now Meta Description
Description: Removes the meta description that was added to hire-now page
Version: 1.0
Author: SEO Audit Tool
*/

// Execute on plugin activation
register_activation_hook(__FILE__, 'revert_hire_now_meta');

function revert_hire_now_meta() {
    // Get the hire-now page
    $page = get_page_by_path('hire-now');
    
    if ($page) {
        $post_id = $page->ID;
        
        // Remove Yoast SEO meta description
        delete_post_meta($post_id, '_yoast_wpseo_metadesc');
        
        // Also remove any other SEO meta that might have been added
        delete_post_meta($post_id, '_yoast_wpseo_title');
        delete_post_meta($post_id, '_yoast_wpseo_focuskw');
        
        // Log the action
        error_log("SEO Audit Tool: Reverted meta description for hire-now page (ID: $post_id)");
        
        // Clear any caches
        if (function_exists('wp_cache_flush')) {
            wp_cache_flush();
        }
        
        // Clear object cache for this post
        clean_post_cache($post_id);
        
        return true;
    }
    
    return false;
}

// Also provide a way to manually trigger this via admin
add_action('admin_menu', function() {
    add_management_page(
        'Revert SEO Changes',
        'Revert SEO Changes', 
        'manage_options',
        'revert-seo-changes',
        'revert_seo_changes_page'
    );
});

function revert_seo_changes_page() {
    if (isset($_POST['revert_hire_now'])) {
        $result = revert_hire_now_meta();
        if ($result) {
            echo '<div class="notice notice-success"><p>Successfully reverted meta description for hire-now page!</p></div>';
        } else {
            echo '<div class="notice notice-error"><p>Failed to revert - hire-now page not found.</p></div>';
        }
    }
    
    ?>
    <div class="wrap">
        <h1>Revert SEO Changes</h1>
        <p>This will remove the meta description that was added to the hire-now page.</p>
        
        <form method="post">
            <input type="submit" name="revert_hire_now" class="button button-primary" value="Revert Hire Now Meta Description" />
        </form>
        
        <h2>Current Status</h2>
        <?php
        $page = get_page_by_path('hire-now');
        if ($page) {
            $meta_desc = get_post_meta($page->ID, '_yoast_wpseo_metadesc', true);
            echo '<p><strong>Current Meta Description:</strong> ' . ($meta_desc ? esc_html($meta_desc) : '<em>None</em>') . '</p>';
        }
        ?>
    </div>
    <?php
}

// REST API endpoint for external access
add_action('rest_api_init', function () {
    register_rest_route('seo-audit/v1', '/revert-hire-now', [
        'methods' => 'POST',
        'callback' => function() {
            $result = revert_hire_now_meta();
            return [
                'success' => $result,
                'message' => $result ? 'Meta description reverted successfully' : 'Failed to revert meta description',
                'page_id' => $result ? get_page_by_path('hire-now')->ID : null
            ];
        },
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);
});
?>