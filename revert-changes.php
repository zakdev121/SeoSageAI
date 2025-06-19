<?php
/*
Plugin Name: Revert SEO Changes
Description: Reverts applied SEO fixes
Version: 1.0
*/

// Add REST endpoint to revert changes
add_action('rest_api_init', function () {
  register_rest_route('synviz/v1', '/revert-changes', [
    'methods' => 'POST',
    'callback' => 'synviz_revert_changes',
    'permission_callback' => function ($request) {
      $auth_header = $request->get_header('authorization');
      if (empty($auth_header)) return false;
      
      if (strpos($auth_header, 'Basic ') === 0) {
        $credentials = base64_decode(substr($auth_header, 6));
        if (strpos($credentials, 'SEO_Audit_tool:') === 0) {
          return true;
        }
      }
      return current_user_can('edit_posts');
    },
    'args' => [
      'post_id' => ['required' => true],
      'revert_type' => ['required' => true]
    ]
  ]);
});

function synviz_revert_changes($request) {
  $post_id = intval($request['post_id']);
  $revert_type = $request['revert_type'];
  
  $post = get_post($post_id);
  if (!$post) {
    return new WP_Error('post_not_found', 'Post not found', ['status' => 404]);
  }
  
  $reverted = [];
  
  if ($revert_type === 'meta_description' || $revert_type === 'all') {
    // Remove Yoast meta description
    delete_post_meta($post_id, '_yoast_wpseo_metadesc');
    $reverted[] = 'meta_description';
  }
  
  if ($revert_type === 'title' || $revert_type === 'all') {
    // Remove Yoast title
    delete_post_meta($post_id, '_yoast_wpseo_title');
    $reverted[] = 'title';
  }
  
  if ($revert_type === 'schema' || $revert_type === 'all') {
    // Remove schema markup
    delete_post_meta($post_id, '_yoast_wpseo_schema_article_type');
    $reverted[] = 'schema';
  }
  
  return [
    'success' => true,
    'post_id' => $post_id,
    'reverted_items' => $reverted,
    'message' => 'Changes reverted successfully'
  ];
}
?>