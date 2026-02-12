const bcrypt = require('bcrypt');

/**
 * Script para generar hashes de contraseñas
 * Útil para crear usuarios iniciales
 */

const generateHash = async (password) => {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
};

// Función principal
const main = async () => {
  const password = process.argv[2] || 'password123';
  
  console.log('Generando hash para contraseña...');
  console.log('Contraseña:', password);
  
  const hash = await generateHash(password);
  
  console.log('\n✅ Hash generado:');
  console.log(hash);
  console.log('\nUsa este hash en el campo password_hash de la tabla usuarios');
};

// Ejecutar si se llama directamentes
if (require.main === module) {
  main();
}

module.exports = { generateHash };
