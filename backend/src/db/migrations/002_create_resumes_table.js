// Migration: Create resumes table
// This migration creates a table to store metadata about uploaded resumes

exports.up = async function(knex) {
    return knex.schema.createTable('resumes', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable();
        table.string('filename').notNullable();
        table.string('original_name').notNullable();
        table.string('file_path').notNullable();
        table.integer('file_size').notNullable();
        table.string('mime_type').notNullable();
        table.timestamp('uploaded_at').defaultTo(knex.fn.now());
        table.timestamp('parsed_at').nullable(); // For future Hugging Face integration
        table.json('parsed_data').nullable();    // For storing extracted data

        // Indexes for performance
        table.index('user_id');
        table.index('uploaded_at');

        // Foreign key constraint
        table.foreign('user_id').references('users.id').onDelete('CASCADE');
    });
};

exports.down = async function(knex) {
    return knex.schema.dropTable('resumes');
};