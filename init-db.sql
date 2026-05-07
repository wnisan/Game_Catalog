IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'GameCatalog')
BEGIN
    CREATE DATABASE GameCatalog;
END
GO

USE GameCatalog;
GO

IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = 'gamecatalog')
BEGIN
    CREATE LOGIN gamecatalog WITH PASSWORD = 'GameCatalog123!';
END
GO

IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'gamecatalog')
BEGIN
    CREATE USER gamecatalog FOR LOGIN gamecatalog;
    ALTER ROLE db_owner ADD MEMBER gamecatalog;
END
GO
