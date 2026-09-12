import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { LucideExternalLink, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-legal-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    LucideExternalLink,
    LucideX,
  ],
  templateUrl: './legal-dialog.component.html',
  styleUrl: './legal-dialog.component.scss',
})
export class LegalDialogComponent {}
