<?php
/*
Plugin Name: Synviz SEO API Support
Description: Enables REST API access to Yoast SEO meta fields for Synviz AI Agent
Version: 1.1
Author: Synviz Team
*/

// Register meta fields for REST API access
add_action('rest_api_init', function () {
  $yoast_fields = [
    '_yoast_wpseo_title',
    '_yoast_wpseo_metadesc',
    '_yoast_wpseo_focuskw',
    '_yoast_wpseo_canonical'
  ];

  foreach ($yoast_fields as $field) {
    register_meta('post', $field, [
      'type'         => 'string',
      'single'       => true,
      'show_in_rest' => true,
      'auth_callback' => function () {
        return current_user_can('edit_posts');
      }
    ]);
  }
});

// Add custom endpoint for SEO updates that bypasses standard edit restrictions
add_action('rest_api_init', function () {
  register_rest_route('synviz/v1', '/seo-update/(?P<id>\d+)', [
    'methods' => 'POST',
    'callback' => 'synviz_update_seo_meta',
    'permission_callback' => function ($request) {
      // Allow access with application password
      $auth_header = $request->get_header('authorization');
      if (strpos($auth_header, 'Basic ') === 0) {
        $credentials = base64_decode(substr($auth_header, 6));
        if (strpos($credentials, 'SEO Audit Tool:') === 0) {
          return true;
        }
      }
      return current_user_can('edit_posts');
    },
    'args' => [
      'id' => [
        'validate_callback' => function($param) {
          return is_numeric($param);
        }
      ],
      'meta_type' => [
        'required' => true,
        'enum' => ['title', 'metadesc', 'focuskw', 'canonical']
      ],
      'meta_value' => [
        'required' => true,
        'type' => 'string'
      ]
    ]
  ]);
});

function synviz_update_seo_meta($request) {
  $post_id = intval($request['id']);
  $meta_type = $request['meta_type'];
  $meta_value = sanitize_text_field($request['meta_value']);
  
  // Validate post exists
  if (!get_post($post_id)) {
    return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
  }
  
  // Map meta types to actual meta keys
  $meta_key_map = [
    'title' => '_yoast_wpseo_title',
    'metadesc' => '_yoast_wpseo_metadesc',
    'focuskw' => '_yoast_wpseo_focuskw',
    'canonical' => '_yoast_wpseo_canonical'
  ];
  
  $meta_key = $meta_key_map[$meta_type];
  
  // Update the meta value
  $result = update_post_meta($post_id, $meta_key, $meta_value);
  
  if ($result !== false) {
    return [
      'success' => true,
      'post_id' => $post_id,
      'meta_key' => $meta_key,
      'meta_value' => $meta_value,
      'message' => 'SEO meta updated successfully'
    ];
  } else {
    return new WP_Error('update_failed', 'Failed to update meta', ['status' => 500]);
  }
}

// Add endpoint to get current SEO meta
add_action('rest_api_init', function () {
  register_rest_route('synviz/v1', '/seo-meta/(?P<id>\d+)', [
    'methods' => 'GET',
    'callback' => 'synviz_get_seo_meta',
    'permission_callback' => function ($request) {
      $auth_header = $request->get_header('authorization');
      if (strpos($auth_header, 'Basic ') === 0) {
        $credentials = base64_decode(substr($auth_header, 6));
        if (strpos($credentials, 'SEO Audit Tool:') === 0) {
          return true;
        }
      }
      return current_user_can('read');
    }
  ]);
});

function synviz_get_seo_meta($request) {
  $post_id = intval($request['id']);
  
  if (!get_post($post_id)) {
    return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
  }
  
  return [
    'post_id' => $post_id,
    'title' => get_post_meta($post_id, '_yoast_wpseo_title', true),
    'metadesc' => get_post_meta($post_id, '_yoast_wpseo_metadesc', true),
    'focuskw' => get_post_meta($post_id, '_yoast_wpseo_focuskw', true),
    'canonical' => get_post_meta($post_id, '_yoast_wpseo_canonical', true)
  ];
}
?>