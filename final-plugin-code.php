<?php
/*
Plugin Name: Synviz SEO API Support
Description: Enables REST API access to Yoast SEO meta fields for Synviz AI Agent
Version: 1.3
Author: Synviz Team
*/

// Add custom endpoint for SEO meta updates
add_action('rest_api_init', function () {
  register_rest_route('synviz/v1', '/update-meta', [
    'methods' => 'POST',
    'callback' => 'synviz_update_meta_callback',
    'permission_callback' => function ($request) {
      // Check authorization header
      $auth_header = $request->get_header('authorization');
      if (empty($auth_header)) {
        return false;
      }
      
      // Extract credentials from Basic auth
      if (strpos($auth_header, 'Basic ') === 0) {
        $credentials = base64_decode(substr($auth_header, 6));
        
        // Check for the updated SEO Audit tool credentials
        if (strpos($credentials, 'SEO_Audit_tool:') === 0) {
          return true;
        }
      }
      
      // Fallback to standard WordPress permissions
      return current_user_can('edit_posts');
    },
    'args' => [
      'post_id' => [
        'required' => true,
        'validate_callback' => function($param) {
          return is_numeric($param);
        }
      ],
      'meta_description' => [
        'required' => true,
        'type' => 'string'
      ]
    ]
  ]);
});

function synviz_update_meta_callback($request) {
  $post_id = intval($request['post_id']);
  $meta_description = sanitize_text_field($request['meta_description']);
  
  // Validate post exists
  $post = get_post($post_id);
  if (!$post) {
    return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
  }
  
  // Update Yoast SEO meta description
  $result = update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_description);
  
  if ($result !== false) {
    return [
      'success' => true,
      'post_id' => $post_id,
      'post_title' => $post->post_title,
      'meta_description' => $meta_description,
      'message' => 'Meta description updated successfully via Synviz AI Agent',
      'timestamp' => current_time('mysql')
    ];
  } else {
    return new WP_Error('update_failed', 'Failed to update meta description', ['status' => 500]);
  }
}

// Add endpoint for title updates
add_action('rest_api_init', function () {
  register_rest_route('synviz/v1', '/update-title', [
    'methods' => 'POST',
    'callback' => 'synviz_update_title_callback',
    'permission_callback' => function ($request) {
      $auth_header = $request->get_header('authorization');
      if (!empty($auth_header) && strpos($auth_header, 'Basic ') === 0) {
        $credentials = base64_decode(substr($auth_header, 6));
        if (strpos($credentials, 'SEO_Audit_tool:') === 0) {
          return true;
        }
      }
      return current_user_can('edit_posts');
    },
    'args' => [
      'post_id' => ['required' => true, 'validate_callback' => function($param) { return is_numeric($param); }],
      'title' => ['required' => true, 'type' => 'string']
    ]
  ]);
});

function synviz_update_title_callback($request) {
  $post_id = intval($request['post_id']);
  $title = sanitize_text_field($request['title']);
  
  $post = get_post($post_id);
  if (!$post) {
    return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
  }
  
  $result = update_post_meta($post_id, '_yoast_wpseo_title', $title);
  
  if ($result !== false) {
    return [
      'success' => true,
      'post_id' => $post_id,
      'post_title' => $post->post_title,
      'seo_title' => $title,
      'message' => 'SEO title updated successfully'
    ];
  } else {
    return new WP_Error('update_failed', 'Failed to update title', ['status' => 500]);
  }
}

// Add endpoint to get current meta data
add_action('rest_api_init', function () {
  register_rest_route('synviz/v1', '/get-meta/(?P<id>\d+)', [
    'methods' => 'GET',
    'callback' => 'synviz_get_meta_callback',
    'permission_callback' => function ($request) {
      $auth_header = $request->get_header('authorization');
      if (!empty($auth_header) && strpos($auth_header, 'Basic ') === 0) {
        $credentials = base64_decode(substr($auth_header, 6));
        if (strpos($credentials, 'SEO_Audit_tool:') === 0) {
          return true;
        }
      }
      return current_user_can('read');
    }
  ]);
});

function synviz_get_meta_callback($request) {
  $post_id = intval($request['id']);
  
  $post = get_post($post_id);
  if (!$post) {
    return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
  }
  
  return [
    'post_id' => $post_id,
    'post_title' => $post->post_title,
    'current_meta_description' => get_post_meta($post_id, '_yoast_wpseo_metadesc', true),
    'yoast_title' => get_post_meta($post_id, '_yoast_wpseo_title', true),
    'focus_keyword' => get_post_meta($post_id, '_yoast_wpseo_focuskw', true),
    'canonical' => get_post_meta($post_id, '_yoast_wpseo_canonical', true)
  ];
}
?>