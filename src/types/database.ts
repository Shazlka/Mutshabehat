export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type PartType = 'shared' | 'diff' | 'diff2' | 'diff3' | 'addition' | 'unique' | 'normal'
export type GroupStatus = 'draft' | 'published' | 'locked'

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string
          user_id: string
          title: string
          color: string
          note: string | null
          unote: string | null
          status: GroupStatus
          favorite: boolean
          completed: boolean
          created_at: string
          updated_at: string
          search_vec: unknown | null
        }
        Insert: Omit<Database['public']['Tables']['groups']['Row'], 'id' | 'created_at' | 'updated_at' | 'search_vec'>
        Update: Partial<Database['public']['Tables']['groups']['Insert']>
      }
      verses: {
        Row: {
          id: string
          group_id: string
          surah: string
          ayah: number
          label: string | null
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['verses']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['verses']['Insert']>
      }
      parts: {
        Row: {
          id: string
          verse_id: string
          type: PartType
          text: string
          sort_order: number
        }
        Insert: Omit<Database['public']['Tables']['parts']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['parts']['Insert']>
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
        }
        Insert: Omit<Database['public']['Tables']['tags']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['tags']['Insert']>
      }
      group_tags: {
        Row: { group_id: string; tag_id: string }
        Insert: Database['public']['Tables']['group_tags']['Row']
        Update: Partial<Database['public']['Tables']['group_tags']['Row']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ── Convenience types with relations ─────────────────────────────────────────
export type Group = Database['public']['Tables']['groups']['Row']
export type Verse = Database['public']['Tables']['verses']['Row']
export type Part  = Database['public']['Tables']['parts']['Row']
export type Tag   = Database['public']['Tables']['tags']['Row']

export interface PartWithType extends Part { type: PartType }

export interface VerseWithParts extends Verse {
  parts: PartWithType[]
}

export interface GroupWithVerses extends Group {
  verses: VerseWithParts[]
  tags?: Tag[]
}
