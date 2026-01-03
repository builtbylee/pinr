#!/usr/bin/env python3

import re
import uuid

# Read the pbxproj file
with open('ios/Pinr.xcodeproj/project.pbxproj', 'r') as f:
    content = f.read()

# Generate unique IDs for the new file
file_ref_id = str(uuid.uuid4()).replace('-', '')[:24].upper()
build_file_id = str(uuid.uuid4()).replace('-', '')[:24].upper()

print(f"Generated FileRef ID: {file_ref_id}")
print(f"Generated BuildFile ID: {build_file_id}")

# 1. Add PBXBuildFile entry (after AppDelegate.swift build file)
build_file_entry = f'\t\t{build_file_id} /* FirebaseEarlyConfig.m in Sources */ = {{isa = PBXBuildFile; fileRef = {file_ref_id} /* FirebaseEarlyConfig.m */; }};\n'

# Find the AppDelegate build file line and add after it
appdelegate_build_pattern = r'(F11748422D0307B40044C1D9 /\* AppDelegate\.swift in Sources \*/ = \{isa = PBXBuildFile.*?\};\n)'
content = re.sub(appdelegate_build_pattern, r'\1' + build_file_entry, content)

# 2. Add PBXFileReference entry (after AppDelegate.swift file reference)
file_ref_entry = f'\t\t{file_ref_id} /* FirebaseEarlyConfig.m */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; name = FirebaseEarlyConfig.m; path = Pinr/FirebaseEarlyConfig.m; sourceTree = "<group>"; }};\n'

appdelegate_ref_pattern = r'(F11748412D0307B40044C1D9 /\* AppDelegate\.swift \*/ = \{isa = PBXFileReference.*?\};\n)'
content = re.sub(appdelegate_ref_pattern, r'\1' + file_ref_entry, content)

# 3. Add to PBXGroup (Pinr group - where AppDelegate.swift is listed)
group_entry = f'\t\t\t\t{file_ref_id} /* FirebaseEarlyConfig.m */,\n'

# Find the group that contains AppDelegate.swift and add after it
group_pattern = r'(F11748412D0307B40044C1D9 /\* AppDelegate\.swift \*/,\n)'
content = re.sub(group_pattern, r'\1' + group_entry, content)

# 4. Add to PBXSourcesBuildPhase (the compile sources list)
sources_entry = f'\t\t\t\t{build_file_id} /* FirebaseEarlyConfig.m in Sources */,\n'

# Find where AppDelegate.swift is in Sources and add after it
sources_pattern = r'(F11748422D0307B40044C1D9 /\* AppDelegate\.swift in Sources \*/,\n)'
content = re.sub(sources_pattern, r'\1' + sources_entry, content)

# Write the modified content back
with open('ios/Pinr.xcodeproj/project.pbxproj', 'w') as f:
    f.write(content)

print("✅ Successfully added FirebaseEarlyConfig.m to Xcode project")
print("✅ File reference added")
print("✅ Build file added")  
print("✅ Added to Pinr group")
print("✅ Added to compile sources")
