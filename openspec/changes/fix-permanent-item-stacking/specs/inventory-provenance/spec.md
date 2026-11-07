# Spec Delta: inventory-provenance

## ADDED Requirements

### Requirement: Permanent items remain individual and keep their type
The system MUST manage each permanent magic item as an individual record. Creating a permanent item MUST result in quantity one. The system MUST reject changes to the quantity or item type of an existing permanent item, and MUST reject any item type change after an inventory item is created. The system MUST preserve quantities on existing legacy permanent records when other fields are edited. Adventure snapshot edits, legacy snapshot creation, and synchronization with the linked warehouse record MUST enforce the same item type invariant before writing changes.

#### Scenario: Create one permanent item
- **WHEN** a player creates a permanent item
- **THEN** the system stores it as one individual item

#### Scenario: Reject multiple permanent items on create
- **WHEN** a player or client requests a permanent item with quantity greater than one
- **THEN** the system rejects the request without writing the item

#### Scenario: Preserve a legacy quantity during an unrelated edit
- **WHEN** a legacy permanent item has quantity greater than one and the player edits another field without changing its quantity
- **THEN** the system preserves the existing quantity

#### Scenario: Reject a permanent quantity change
- **WHEN** a client requests a different quantity for an existing permanent item
- **THEN** the system rejects the request without writing the item

#### Scenario: Reject an item type change
- **WHEN** a client attempts to change an existing inventory item or adventure loot record from permanent to consumable, or consumable to permanent
- **THEN** the system rejects the request before persisting the change

#### Scenario: Reject a type change during legacy snapshot creation
- **WHEN** an adventure edit attempts to create a snapshot from a legacy warehouse item using a different item type
- **THEN** the system rejects the request without creating the snapshot or changing the warehouse item

#### Scenario: Edit permanent items without a quantity control
- **WHEN** a player edits a permanent item in the inventory form
- **THEN** the form hides quantity and displays the existing type as read-only
