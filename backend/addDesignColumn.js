const pool = require('./db');

async function addDesignColumn() {
  try {
    console.log('Adding design column to cards table...');
    
    const result = await pool.query(`
      ALTER TABLE cards 
      ADD COLUMN IF NOT EXISTS design VARCHAR(50) DEFAULT 'netscard1'
    `);
    
    console.log('Design column added successfully!');
    
    // Verify the column was added
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cards' AND column_name = 'design'
    `);
    
    if (columnsResult.rows.length > 0) {
      console.log('Design column verified:', columnsResult.rows[0]);
    } else {
      console.log('Design column not found');
    }
    
  } catch (error) {
    console.error('Error adding design column:', error);
  } finally {
    await pool.end();
  }
}

addDesignColumn();
