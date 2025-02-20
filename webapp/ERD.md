```mermaid
erDiagram

  "User" {
    String id "🗝️"
    String email 
    String name "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Training" {
    String id "🗝️"
    String name 
    String config 
    String triggerWord 
    Json baseModel "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "TrainingRun" {
    String id "🗝️"
    DateTime createdAt 
    DateTime updatedAt 
    String status 
    }
  

  "TrainingStatus" {
    String id "🗝️"
    String messageId "❓"
    String status 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "TrainingImage" {
    String id "🗝️"
    String text "❓"
    String url 
    String name 
    String type 
    Boolean isResized 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Password" {
    String hash 
    }
  

  "Session" {
    String id "🗝️"
    DateTime expirationDate 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Permission" {
    String id "🗝️"
    String action 
    String entity 
    String access 
    String description 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Role" {
    String id "🗝️"
    String name 
    String description 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Verification" {
    String id "🗝️"
    DateTime createdAt 
    String type 
    String target 
    String secret 
    String algorithm 
    Int digits 
    Int period 
    String charSet 
    DateTime expiresAt "❓"
    }
  

  "Connection" {
    String id "🗝️"
    String providerName 
    String providerId 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Gpu" {
    String id "🗝️"
    String instanceId 
    String status 
    DateTime createdAt 
    DateTime updatedAt 
    String trainingId "❓"
    }
  
    "User" o{--}o "Password" : "password"
    "User" o{--}o "Training" : "trainings"
    "User" o{--}o "Role" : "roles"
    "User" o{--}o "Session" : "sessions"
    "User" o{--}o "Connection" : "connections"
    "Training" o|--|o "Gpu" : "gpu"
    "Training" o|--|| "User" : "owner"
    "Training" o{--}o "TrainingImage" : "images"
    "Training" o{--}o "TrainingRun" : "runs"
    "TrainingRun" o|--|| "Training" : "training"
    "TrainingRun" o{--}o "TrainingStatus" : "statuses"
    "TrainingStatus" o|--|| "TrainingRun" : "run"
    "TrainingImage" o|--|| "Training" : "training"
    "Password" o|--|| "User" : "user"
    "Session" o|--|| "User" : "user"
    "Permission" o{--}o "Role" : "roles"
    "Role" o{--}o "User" : "users"
    "Role" o{--}o "Permission" : "permissions"
    "Connection" o|--|| "User" : "user"
    "Gpu" o{--}o "Training" : "training"
```
