package com.dndadvlog.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.TransactionDefinition;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

@Configuration
@Profile("prod")
class InventoryTransactionConfig {
    @Bean
    JdbcTransactionManager transactionManager(DataSource dataSource) {
        return new JdbcTransactionManager(dataSource) {
            @Override
            protected void prepareTransactionalConnection(Connection connection, TransactionDefinition definition)
                    throws SQLException {
                super.prepareTransactionalConnection(connection, definition);
                if (!definition.isReadOnly()) {
                    try (var statement = connection.createStatement()) {
                        statement.execute("SET LOCAL advlog.inventory_movements = 'on'");
                    }
                }
            }
        };
    }
}
