#!/usr/bin/env ruby

# Script to add FirebaseEarlyConfig.m to the Xcode project
require 'xcodeproj'

project_path = 'ios/Pinr.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the main target
target = project.targets.find { |t| t.name == 'Pinr' }

# Create a file reference for FirebaseEarlyConfig.m
file_path = 'Pinr/FirebaseEarlyConfig.m'
file_ref = project.main_group.find_file_by_path(file_path) || 
           project.main_group['Pinr'].new_reference(file_path)

# Add to compile sources build phase
compile_phase = target.source_build_phase
unless compile_phase.files.any? { |f| f.file_ref == file_ref }
  compile_phase.add_file_reference(file_ref)
  puts "✅ Added FirebaseEarlyConfig.m to compile sources"
else
  puts "ℹ️  FirebaseEarlyConfig.m already in compile sources"
end

project.save
puts "✅ Project saved successfully"
