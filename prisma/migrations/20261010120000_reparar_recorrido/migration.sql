-- Cerrar una lista le ponia a lo comprado los puestos 0, 1, 2... encima del
-- recorrido, y quedaban productos con el mismo puesto. Se renumera todo de 0 en
-- adelante con el mismo criterio con que la app los ordena (puesto, hoja, id),
-- asi que el orden que se ve no cambia: solo desaparecen los repetidos.
UPDATE "Producto" AS p
SET "ordenCompra" = r.puesto
FROM (
  SELECT id,
         (ROW_NUMBER() OVER (ORDER BY "ordenCompra" ASC, orden ASC, id ASC) - 1)::int AS puesto
  FROM "Producto"
  WHERE "ordenCompra" IS NOT NULL
) AS r
WHERE p.id = r.id;
