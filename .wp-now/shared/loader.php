<?php

function updateWpConfig ( string $content ): string
{
	$comment = 'Multi-environment setup';

	if ( strpos( $content, $comment ) !== FALSE ) {
		return FALSE;
	}

	$lines = explode( "\n", str_replace( [ "\r\n", "\r" ], "\n", $content ) );

	$buffer_total = 2;
	$buffer_count = 0;
	$matched_line = NULL;
	$constant     = 'WP_DEBUG';

	foreach ( $lines as &$line ) {
		if ( empty( $matched_line ) ) {
			if ( preg_match( '/^\s*define\(.*' . preg_quote( $constant, '/' ) . '.*,.*\)/', $line ) ) {
				( $matched_line = $line );
				$line = "// {$line} // Allow the environment setup script a chance to define this first.";
			}
		}
		elseif ( empty( trim( $line ) ) && ++$buffer_count === $buffer_total ) {
			$new_config_path = getcwd() . '/wp-content/.wp-now/wp-config.php';

			$line = <<<END
					$line
					/* $comment */
					if ( file_exists( \$new_config_path = '$new_config_path' ) ) {
						include \$new_config_path;
					}
					if ( !defined( '$constant' ) ) {
						$matched_line
					}
					END;
			break;
		}
	}

	return implode( "\n", $lines );
}

if ( file_exists( $config_path = getcwd() . '/wp-config.php' ) ) {
	$config_content = file_get_contents( $config_path );
	if ( !empty( $config_content = updateWpConfig( $config_content ) ) ) {
		@file_put_contents( $config_path, $config_content );
	}
}
